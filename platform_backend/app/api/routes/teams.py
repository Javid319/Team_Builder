"""
Team formation routes
=====================
POST /api/v1/teams                       — create a team (creator becomes OWNER)
GET  /api/v1/teams                       — browse OPEN teams (paginated/filtered)
GET  /api/v1/teams/{id}                  — team details with members and owner
GET  /api/v1/teams/my-team               — the current user's active team
POST /api/v1/teams/{team_id}/invite      — send a member invitation (owner only)
POST /api/v1/teams/{team_id}/join-request — request to join a team
GET  /api/v1/teams/{team_id}/join-requests — team's join requests (owner only)

All routes require authentication. NOTE: /my-team must be declared before
/{team_id} so "my-team" is not parsed as a UUID path parameter.
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.team import (
    InviteCreate,
    InvitationOut,
    JoinRequestOut,
    TeamCreate,
    TeamListResponse,
    TeamOut,
)
from app.services.invitations import (
    AlreadyMemberError,
    DuplicateInvitationError,
    NotTeamOwnerError,
    ReceiverInActiveTeamError,
    ReceiverNotFoundError,
    TeamFullError,
    TeamNotFoundError as InvitationTeamNotFoundError,
    build_invitation_out,
    create_invitation,
)
from app.services.join_requests import (
    AlreadyInActiveTeamError as JoinAlreadyInActiveTeamError,
    AlreadyMemberError as JoinAlreadyMemberError,
    DuplicateJoinRequestError,
    NotTeamOwnerError as JoinNotTeamOwnerError,
    TeamFullError as JoinTeamFullError,
    TeamLockedError,
    TeamNotFoundError as JoinTeamNotFoundError,
    build_join_request_out,
    create_join_request,
    list_join_requests,
)
from app.services.team import (
    AlreadyHasActiveTeamError,
    build_team_list_item,
    build_team_out,
    create_team,
    get_active_membership,
    get_team_by_id,
    list_teams,
)

router = APIRouter(prefix="/teams", tags=["Teams"])


def _split(value: Optional[str]) -> List[str]:
    """Split a comma-separated query param into a cleaned list."""
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team_endpoint(
    payload: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a team and add the authenticated user as its OWNER."""
    try:
        team = create_team(
            db,
            current_user,
            payload.name,
            payload.description,
            payload.max_members,
            payload.domains,
        )
    except AlreadyHasActiveTeamError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already part of an active team",
        )
    return build_team_out(db, team)


@router.get("", response_model=TeamListResponse)
def list_teams_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    domain: Optional[str] = Query(
        None, description="Comma-separated domains to include (OR)."
    ),
    search: Optional[str] = Query(
        None, description="Free-text search over team name and description."
    ),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Browse teams. Only OPEN teams are returned, newest first."""
    teams, total = list_teams(
        db,
        page=page,
        page_size=page_size,
        domains=_split(domain),
        search=search,
    )
    return TeamListResponse(
        items=[build_team_list_item(db, team) for team in teams],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/my-team", response_model=TeamOut)
def get_my_team(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the authenticated user's active team (membership as any role)."""
    membership = get_active_membership(db, current_user.id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not part of any active team",
        )

    team = get_team_by_id(db, membership.team_id)
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    return build_team_out(db, team)


@router.get("/{team_id}", response_model=TeamOut)
def get_team(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return a team's details, its members, and its owner."""
    team = get_team_by_id(db, team_id)
    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    return build_team_out(db, team)


@router.post(
    "/{team_id}/invite",
    response_model=InvitationOut,
    status_code=status.HTTP_201_CREATED,
)
def invite_member(
    team_id: uuid.UUID,
    payload: InviteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send an invitation to a user. Only the team owner may invite.

    Validation: team exists, team not full, inviter is the owner, and no
    PENDING invitation already exists for this (team, receiver).
    """
    try:
        invitation = create_invitation(
            db, team_id, current_user, payload.receiver_id
        )
    except InvitationTeamNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    except NotTeamOwnerError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team owner can invite members",
        )
    except ReceiverNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User to invite was not found",
        )
    except TeamFullError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Team is already full",
        )
    except AlreadyMemberError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this team",
        )
    except DuplicateInvitationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An invitation has already been sent to this user",
        )
    except ReceiverInActiveTeamError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already part of another active team",
        )
    return build_invitation_out(db, invitation)


@router.post(
    "/{team_id}/join-request",
    response_model=JoinRequestOut,
    status_code=status.HTTP_201_CREATED,
)
def create_join_request_endpoint(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a join request to an OPEN team.

    Validation: team exists and is OPEN, no duplicate PENDING request, and
    the requester is not already a member or part of another active team.
    """
    try:
        join_request = create_join_request(db, team_id, current_user)
    except JoinTeamNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    except JoinTeamFullError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Team is already full",
        )
    except TeamLockedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Team is not accepting join requests",
        )
    except JoinAlreadyMemberError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this team",
        )
    except JoinAlreadyInActiveTeamError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already part of another active team",
        )
    except DuplicateJoinRequestError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending request for this team",
        )
    return build_join_request_out(db, join_request)


@router.get("/{team_id}/join-requests", response_model=list[JoinRequestOut])
def get_join_requests_endpoint(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List a team's join requests, newest first (owner only)."""
    try:
        requests = list_join_requests(db, team_id, current_user)
    except JoinTeamNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    except JoinNotTeamOwnerError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team owner can view join requests",
        )
    return [build_join_request_out(db, request) for request in requests]
