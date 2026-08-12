"""
Service layer for the team invitation workflow.

Lifecycle: PENDING -> ACCEPTED | REJECTED | CANCELLED.

Domain exceptions are raised here and mapped to HTTP responses by the
route layer. Validation rules:
- the team must exist
- the team must not be full
- only the team owner can invite
- no duplicate PENDING invitation for the same (team, receiver)
- the receiver must exist and not already be a member
- the receiver must not be part of another active team
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.team import (
    InvitationStatus,
    Team,
    TeamInvitation,
    TeamMember,
    TeamMemberRole,
    TeamStatus,
)
from app.models.user import User
from app.schemas.team import InvitationOut, InvitationTeamOut, InvitationUserOut

INVITATION_EXPIRY_DAYS = 7


class InvitationServiceError(Exception):
    """Base class for invitation service domain errors."""


class TeamNotFoundError(InvitationServiceError):
    """The team does not exist."""


class TeamFullError(InvitationServiceError):
    """The team has reached max_members."""


class NotTeamOwnerError(InvitationServiceError):
    """Only the team owner may send invitations."""


class ReceiverNotFoundError(InvitationServiceError):
    """The invited user does not exist."""


class AlreadyMemberError(InvitationServiceError):
    """The user is already a member of the team."""


class DuplicateInvitationError(InvitationServiceError):
    """A PENDING invitation already exists for this (team, receiver)."""


class ReceiverInActiveTeamError(InvitationServiceError):
    """The user is already part of another OPEN/FULL team."""


class InvitationNotFoundError(InvitationServiceError):
    """No invitation exists for the requested id."""


class NotInvitationReceiverError(InvitationServiceError):
    """The current user is not the receiver of this invitation."""


class InvitationNotPendingError(InvitationServiceError):
    """The invitation is not in PENDING state."""


def _member_count(db: Session, team_id: uuid.UUID) -> int:
    return (
        db.query(TeamMember.id).filter(TeamMember.team_id == team_id).count()
    )


def create_invitation(
    db: Session,
    team_id: uuid.UUID,
    sender: User,
    receiver_id: uuid.UUID,
) -> TeamInvitation:
    """Send a PENDING invitation from the team owner to a user."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if team is None:
        raise TeamNotFoundError("Team not found")

    if team.owner_id != sender.id:
        raise NotTeamOwnerError("Only the team owner can invite members")

    if _member_count(db, team.id) >= team.max_members:
        raise TeamFullError("Team is already full")

    receiver = db.query(User).filter(User.id == receiver_id).first()
    if receiver is None:
        raise ReceiverNotFoundError("User to invite was not found")

    existing_member = (
        db.query(TeamMember.id)
        .filter(
            TeamMember.team_id == team.id,
            TeamMember.user_id == receiver_id,
        )
        .first()
    )
    if existing_member:
        raise AlreadyMemberError("User is already a member of this team")

    duplicate = (
        db.query(TeamInvitation.id)
        .filter(
            TeamInvitation.team_id == team.id,
            TeamInvitation.receiver_id == receiver_id,
            TeamInvitation.status == InvitationStatus.PENDING,
        )
        .first()
    )
    if duplicate:
        raise DuplicateInvitationError(
            "An invitation has already been sent to this user"
        )

    receiver_active = (
        db.query(TeamMember)
        .join(Team, Team.id == TeamMember.team_id)
        .filter(
            TeamMember.user_id == receiver_id,
            Team.status.in_([TeamStatus.OPEN, TeamStatus.FULL]),
        )
        .first()
    )
    if receiver_active:
        raise ReceiverInActiveTeamError(
            "User is already part of another active team"
        )

    invitation = TeamInvitation(
        team_id=team.id,
        sender_id=sender.id,
        receiver_id=receiver_id,
        status=InvitationStatus.PENDING,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=INVITATION_EXPIRY_DAYS),
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation


def list_invitations(db: Session, user_id: uuid.UUID) -> List[TeamInvitation]:
    """All invitations received by a user, newest first."""
    return (
        db.query(TeamInvitation)
        .filter(TeamInvitation.receiver_id == user_id)
        .order_by(TeamInvitation.created_at.desc())
        .all()
    )


def _get_invitation_for_user_or_raise(
    db: Session, invitation_id: uuid.UUID, user: User
) -> TeamInvitation:
    invitation = (
        db.query(TeamInvitation)
        .filter(TeamInvitation.id == invitation_id)
        .first()
    )
    if invitation is None:
        raise InvitationNotFoundError("Invitation not found")
    if invitation.receiver_id != user.id:
        raise NotInvitationReceiverError(
            "This invitation was not sent to you"
        )
    return invitation


def _ensure_pending(invitation: TeamInvitation) -> None:
    if invitation.status != InvitationStatus.PENDING:
        raise InvitationNotPendingError("Invitation is not pending")


def accept_invitation(
    db: Session, invitation_id: uuid.UUID, user: User
) -> TeamInvitation:
    """Accept a PENDING invitation, adding the user to the team as MEMBER.

    Flipping the team to FULL is handled here so capacity and status stay
    consistent; the single-active-team DB trigger remains the safety net.
    """
    invitation = _get_invitation_for_user_or_raise(db, invitation_id, user)
    _ensure_pending(invitation)

    team = db.query(Team).filter(Team.id == invitation.team_id).first()
    if team is None:
        raise TeamNotFoundError("Team not found")

    if _member_count(db, team.id) >= team.max_members:
        raise TeamFullError("Team is already full")

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

    receiver_active = (
        db.query(TeamMember)
        .join(Team, Team.id == TeamMember.team_id)
        .filter(
            TeamMember.user_id == user.id,
            TeamMember.team_id != team.id,
            Team.status.in_([TeamStatus.OPEN, TeamStatus.FULL]),
        )
        .first()
    )
    if receiver_active:
        raise ReceiverInActiveTeamError(
            "You are already part of another active team"
        )

    db.add(
        TeamMember(
            team_id=team.id,
            user_id=user.id,
            role=TeamMemberRole.MEMBER,
        )
    )
    invitation.status = InvitationStatus.ACCEPTED

    if _member_count(db, team.id) + 1 >= team.max_members:
        team.status = TeamStatus.FULL

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ReceiverInActiveTeamError(
            "You are already part of another active team"
        )

    db.refresh(invitation)
    return invitation


def reject_invitation(
    db: Session, invitation_id: uuid.UUID, user: User
) -> TeamInvitation:
    """Reject a PENDING invitation."""
    invitation = _get_invitation_for_user_or_raise(db, invitation_id, user)
    _ensure_pending(invitation)

    invitation.status = InvitationStatus.REJECTED
    db.commit()
    db.refresh(invitation)
    return invitation


def build_invitation_out(db: Session, invitation: TeamInvitation) -> InvitationOut:
    """Serialize an invitation with team + sender + receiver context."""
    team = db.query(Team).filter(Team.id == invitation.team_id).first()
    sender = db.query(User).filter(User.id == invitation.sender_id).first()
    receiver = db.query(User).filter(User.id == invitation.receiver_id).first()

    return InvitationOut(
        id=invitation.id,
        team_id=invitation.team_id,
        sender_id=invitation.sender_id,
        receiver_id=invitation.receiver_id,
        status=invitation.status,
        created_at=invitation.created_at,
        expires_at=invitation.expires_at,
        team=(
            InvitationTeamOut(
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
        sender=(
            InvitationUserOut(
                id=sender.id, name=sender.full_name, email=sender.email
            )
            if sender
            else None
        ),
        receiver=(
            InvitationUserOut(
                id=receiver.id, name=receiver.full_name, email=receiver.email
            )
            if receiver
            else None
        ),
    )
