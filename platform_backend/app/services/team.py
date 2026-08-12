"""
Service layer for team creation and retrieval.

Domain exceptions are raised here and mapped to HTTP responses by the
route layer. The "one active team per user" rule is enforced both here
(pre-check for a clean error) and by the database trigger as a safety net.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.team import Team, TeamMember, TeamMemberRole, TeamStatus
from app.models.user import User
from app.schemas.team import TeamMemberOut, TeamOut


class TeamServiceError(Exception):
    """Base class for team service domain errors."""


class AlreadyHasActiveTeamError(TeamServiceError):
    """The user is already a member of an OPEN or FULL team."""


class TeamNotFoundError(TeamServiceError):
    """No team exists for the requested id."""


def get_active_membership(db: Session, user_id: uuid.UUID) -> Optional[TeamMember]:
    """The user's membership in an OPEN or FULL team, if any."""
    return (
        db.query(TeamMember)
        .join(Team, Team.id == TeamMember.team_id)
        .filter(
            TeamMember.user_id == user_id,
            Team.status.in_([TeamStatus.OPEN, TeamStatus.FULL]),
        )
        .order_by(TeamMember.joined_at.desc())
        .first()
    )


def get_team_by_id(db: Session, team_id: uuid.UUID) -> Optional[Team]:
    return db.query(Team).filter(Team.id == team_id).first()


def get_membership(
    db: Session, team_id: uuid.UUID, user_id: uuid.UUID
) -> Optional[TeamMember]:
    """A user's membership row for a specific team, if any."""
    return (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
        .first()
    )


def create_team(
    db: Session,
    owner: User,
    name: str,
    description: Optional[str],
    max_members: int,
    domains: Optional[list[str]] = None,
) -> Team:
    """Create a team and add the creator as its OWNER member.

    Raises AlreadyHasActiveTeamError if the user is already a member of an
    active team (also caught by the DB trigger, kept as a safety net).
    """
    existing = get_active_membership(db, owner.id)
    if existing:
        raise AlreadyHasActiveTeamError(
            "You are already part of an active team"
        )

    team = Team(
        name=name,
        description=description,
        domains=list(domains or []),
        owner_id=owner.id,
        max_members=max_members,
    )
    db.add(team)
    db.flush()

    db.add(
        TeamMember(
            team_id=team.id,
            user_id=owner.id,
            role=TeamMemberRole.OWNER,
        )
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AlreadyHasActiveTeamError(
            "You are already part of an active team"
        )

    db.refresh(team)
    return team


def build_team_out(db: Session, team: Team) -> TeamOut:
    """Serialize a team with its members (joined with user info) and owner."""
    rows = (
        db.query(TeamMember, User)
        .join(User, User.id == TeamMember.user_id)
        .filter(TeamMember.team_id == team.id)
        .order_by(TeamMember.joined_at.asc())
        .all()
    )

    member_outs: list[TeamMemberOut] = []
    owner_out: Optional[TeamMemberOut] = None

    for membership, user in rows:
        member_out = TeamMemberOut(
            id=membership.id,
            user_id=membership.user_id,
            role=membership.role,
            joined_at=membership.joined_at,
            name=user.full_name,
            email=user.email,
        )
        member_outs.append(member_out)
        if membership.role == TeamMemberRole.OWNER:
            owner_out = member_out

    return TeamOut(
        id=team.id,
        name=team.name,
        description=team.description,
        domains=list(team.domains or []),
        owner_id=team.owner_id,
        max_members=team.max_members,
        status=team.status,
        created_at=team.created_at,
        updated_at=team.updated_at,
        members=member_outs,
        member_count=len(member_outs),
        owner=owner_out,
    )
