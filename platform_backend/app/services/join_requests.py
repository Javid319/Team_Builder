"""
Service layer for the Looking to Join Team workflow.

Lifecycle: PENDING -> ACCEPTED | REJECTED.

Domain exceptions are raised here and mapped to HTTP responses by the
route layer. Validation rules:
- the team must exist and be OPEN (not FULL/LOCKED)
- no duplicate PENDING request for the same (team, user)
- the requester must not already be a member of this team
- the requester must not be part of another active team
- only the team owner may view/accept/reject requests
"""
from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.profile import Profile
from app.models.team import (
    JoinRequestStatus,
    Team,
    TeamJoinRequest,
    TeamMember,
    TeamMemberRole,
    TeamStatus,
)
from app.models.user import User
from app.schemas.team import (
    JoinRequestOut,
    JoinRequestTeamOut,
    JoinRequestUserOut,
)


class JoinRequestServiceError(Exception):
    """Base class for join request service domain errors."""


class TeamNotFoundError(JoinRequestServiceError):
    """The team does not exist."""


class TeamFullError(JoinRequestServiceError):
    """The team has reached max_members."""


class TeamLockedError(JoinRequestServiceError):
    """The team is LOCKED and not accepting join requests."""


class AlreadyMemberError(JoinRequestServiceError):
    """The user is already a member of the team."""


class AlreadyInActiveTeamError(JoinRequestServiceError):
    """The user is already part of another OPEN/FULL team."""


class DuplicateJoinRequestError(JoinRequestServiceError):
    """A PENDING join request already exists for this (team, user)."""


class JoinRequestNotFoundError(JoinRequestServiceError):
    """No join request exists for the requested id."""


class NotTeamOwnerError(JoinRequestServiceError):
    """Only the team owner may manage join requests."""


class JoinRequestNotPendingError(JoinRequestServiceError):
    """The join request is not in PENDING state."""


def _member_count(db: Session, team_id: uuid.UUID) -> int:
    return (
        db.query(TeamMember.id).filter(TeamMember.team_id == team_id).count()
    )


def _user_in_active_team(
    db: Session, user_id: uuid.UUID, exclude_team_id: Optional[uuid.UUID] = None
) -> Optional[TeamMember]:
    query = (
        db.query(TeamMember)
        .join(Team, Team.id == TeamMember.team_id)
        .filter(
            TeamMember.user_id == user_id,
            Team.status.in_([TeamStatus.OPEN, TeamStatus.FULL]),
        )
    )
    if exclude_team_id is not None:
        query = query.filter(TeamMember.team_id != exclude_team_id)
    return query.first()


def create_join_request(
    db: Session, team_id: uuid.UUID, user: User
) -> TeamJoinRequest:
    """Send a PENDING join request from a user to a team."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if team is None:
        raise TeamNotFoundError("Team not found")

    if team.status == TeamStatus.FULL:
        raise TeamFullError("Team is already full")
    if team.status == TeamStatus.LOCKED:
        raise TeamLockedError("Team is not accepting join requests")

    existing_member = (
        db.query(TeamMember.id)
        .filter(
            TeamMember.team_id == team.id,
            TeamMember.user_id == user.id,
        )
        .first()
    )
    if existing_member:
        raise AlreadyMemberError("You are already a member of this team")

    if _user_in_active_team(db, user.id, exclude_team_id=team.id):
        raise AlreadyInActiveTeamError(
            "You are already part of another active team"
        )

    duplicate = (
        db.query(TeamJoinRequest.id)
        .filter(
            TeamJoinRequest.team_id == team.id,
            TeamJoinRequest.user_id == user.id,
            TeamJoinRequest.status == JoinRequestStatus.PENDING,
        )
        .first()
    )
    if duplicate:
        raise DuplicateJoinRequestError(
            "You already have a pending request for this team"
        )

    join_request = TeamJoinRequest(
        team_id=team.id,
        user_id=user.id,
        status=JoinRequestStatus.PENDING,
    )
    db.add(join_request)
    db.commit()
    db.refresh(join_request)
    return join_request


def list_my_join_requests(
    db: Session, user_id: uuid.UUID
) -> List[TeamJoinRequest]:
    """All join requests sent by a user, newest first."""
    return (
        db.query(TeamJoinRequest)
        .filter(TeamJoinRequest.user_id == user_id)
        .order_by(TeamJoinRequest.created_at.desc())
        .all()
    )


def list_join_requests(
    db: Session, team_id: uuid.UUID, owner: User
) -> List[TeamJoinRequest]:
    """All join requests for a team, newest first (owner only)."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if team is None:
        raise TeamNotFoundError("Team not found")

    if team.owner_id != owner.id:
        raise NotTeamOwnerError("Only the team owner can view join requests")

    return (
        db.query(TeamJoinRequest)
        .filter(TeamJoinRequest.team_id == team.id)
        .order_by(TeamJoinRequest.created_at.desc())
        .all()
    )


def _get_request_for_owner_or_raise(
    db: Session, join_request_id: uuid.UUID, owner: User
):
    """Load a join request; the owner must own the request's team."""
    join_request = (
        db.query(TeamJoinRequest)
        .filter(TeamJoinRequest.id == join_request_id)
        .first()
    )
    if join_request is None:
        raise JoinRequestNotFoundError("Join request not found")

    team = db.query(Team).filter(Team.id == join_request.team_id).first()
    if team is None or team.owner_id != owner.id:
        raise NotTeamOwnerError("Only the team owner can manage join requests")
    return join_request, team


def _ensure_pending(join_request: TeamJoinRequest) -> None:
    if join_request.status != JoinRequestStatus.PENDING:
        raise JoinRequestNotPendingError("Join request is not pending")


def accept_join_request(
    db: Session, join_request_id: uuid.UUID, owner: User
) -> TeamJoinRequest:
    """Accept a PENDING join request, adding the user as a MEMBER."""
    join_request, team = _get_request_for_owner_or_raise(
        db, join_request_id, owner
    )
    _ensure_pending(join_request)

    if _member_count(db, team.id) >= team.max_members:
        raise TeamFullError("Team is already full")

    requester_id = join_request.user_id

    existing_member = (
        db.query(TeamMember.id)
        .filter(
            TeamMember.team_id == team.id,
            TeamMember.user_id == requester_id,
        )
        .first()
    )
    if existing_member:
        raise AlreadyMemberError("User is already a member of this team")

    if _user_in_active_team(db, requester_id, exclude_team_id=team.id):
        raise AlreadyInActiveTeamError(
            "User is already part of another active team"
        )

    db.add(
        TeamMember(
            team_id=team.id,
            user_id=requester_id,
            role=TeamMemberRole.MEMBER,
        )
    )
    join_request.status = JoinRequestStatus.ACCEPTED

    if _member_count(db, team.id) + 1 >= team.max_members:
        team.status = TeamStatus.FULL

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AlreadyInActiveTeamError(
            "User is already part of another active team"
        )

    db.refresh(join_request)
    return join_request


def reject_join_request(
    db: Session, join_request_id: uuid.UUID, owner: User
) -> TeamJoinRequest:
    """Reject a PENDING join request."""
    join_request, _ = _get_request_for_owner_or_raise(
        db, join_request_id, owner
    )
    _ensure_pending(join_request)

    join_request.status = JoinRequestStatus.REJECTED
    db.commit()
    db.refresh(join_request)
    return join_request


def build_join_request_out(
    db: Session, join_request: TeamJoinRequest
) -> JoinRequestOut:
    """Serialize a join request with team + user context."""
    team = db.query(Team).filter(Team.id == join_request.team_id).first()
    user = db.query(User).filter(User.id == join_request.user_id).first()
    profile = (
        db.query(Profile).filter(Profile.user_id == join_request.user_id).first()
    )

    return JoinRequestOut(
        id=join_request.id,
        team_id=join_request.team_id,
        user_id=join_request.user_id,
        status=join_request.status,
        created_at=join_request.created_at,
        team=(
            JoinRequestTeamOut(
                id=team.id,
                name=team.name,
                domains=list(team.domains or []),
                status=team.status,
                member_count=_member_count(db, team.id),
                max_members=team.max_members,
            )
            if team
            else None
        ),
        user=(
            JoinRequestUserOut(
                id=user.id,
                name=user.full_name,
                email=user.email,
                college=profile.college if profile else None,
                role=profile.role if profile else None,
            )
            if user
            else None
        ),
    )
