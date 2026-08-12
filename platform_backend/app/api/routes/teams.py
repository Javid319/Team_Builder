"""
Team formation routes
=====================
POST /api/v1/teams                 — create a team (creator becomes OWNER)
GET  /api/v1/teams/{id}            — team details with members and owner
GET  /api/v1/teams/my-team         — the current user's active team
POST /api/v1/teams/{team_id}/invite — send a member invitation (owner only)

All routes require authentication. NOTE: /my-team must be declared before
/{team_id} so "my-team" is not parsed as a UUID path parameter.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.team import InviteCreate, InvitationOut, TeamCreate, TeamOut
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
from app.services.team import (
    AlreadyHasActiveTeamError,
    build_team_out,
    create_team,
    get_active_membership,
    get_team_by_id,
)

router = APIRouter(prefix="/teams", tags=["Teams"])


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
