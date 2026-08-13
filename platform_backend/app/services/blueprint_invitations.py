import uuid
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.blueprint import (
    Blueprint,
    BlueprintSlot,
    BlueprintMember,
    BlueprintMemberRole,
    BlueprintInvitation,
    BlueprintInvitationStatus,
    BlueprintStatus,
    SlotStatus,
)
from app.models.user import User

INVITATION_TTL_DAYS = 7


class BlueprintInviteError(Exception):
    pass


# ── helpers ───────────────────────────────────────────────────────────────────

def _expire_if_needed(invitation: BlueprintInvitation) -> bool:
    """Transition a PENDING invitation to EXPIRED if it has passed its expires_at.

    Returns True if the invitation was just expired.
    """
    if (
        invitation.status == BlueprintInvitationStatus.PENDING
        and invitation.expires_at is not None
        and invitation.expires_at < datetime.now(timezone.utc)
    ):
        invitation.status = BlueprintInvitationStatus.EXPIRED
        return True
    return False


# ── public API ────────────────────────────────────────────────────────────────

def create_invitation(
    db: Session,
    blueprint_id: uuid.UUID,
    slot_id: uuid.UUID,
    sender: User,
    receiver_id: uuid.UUID,
) -> BlueprintInvitation:
    blueprint = db.query(Blueprint).filter(Blueprint.id == blueprint_id).first()
    if not blueprint:
        raise BlueprintInviteError("Blueprint not found")

    if blueprint.owner_id != sender.id:
        raise BlueprintInviteError("Only the blueprint owner can send invitations")

    if blueprint.status in (BlueprintStatus.FULL, BlueprintStatus.LOCKED):
        raise BlueprintInviteError("This blueprint is no longer accepting new members")

    if receiver_id == sender.id:
        raise BlueprintInviteError("You cannot invite yourself")

    slot = db.query(BlueprintSlot).filter(BlueprintSlot.id == slot_id).first()
    if not slot or slot.blueprint_id != blueprint_id:
        raise BlueprintInviteError("Slot not found in this blueprint")

    if slot.status != SlotStatus.OPEN:
        raise BlueprintInviteError("This slot is no longer open")

    receiver = db.query(User).filter(User.id == receiver_id).first()
    if not receiver:
        raise BlueprintInviteError("Candidate not found")

    existing_member = (
        db.query(BlueprintMember)
        .filter(
            BlueprintMember.blueprint_id == blueprint_id,
            BlueprintMember.user_id == receiver_id,
        )
        .first()
    )
    if existing_member:
        raise BlueprintInviteError("This person is already a member of the blueprint")

    # Expire any stale invitation for this triple before re-checking for a pending one
    stale = (
        db.query(BlueprintInvitation)
        .filter(
            BlueprintInvitation.blueprint_id == blueprint_id,
            BlueprintInvitation.receiver_id == receiver_id,
            BlueprintInvitation.slot_id == slot_id,
        )
        .first()
    )
    if stale:
        _expire_if_needed(stale)
        db.flush()
        if stale.status == BlueprintInvitationStatus.PENDING:
            raise BlueprintInviteError(
                "A pending invitation already exists for this candidate to this slot"
            )
        # Non-pending (REJECTED, CANCELLED, EXPIRED) — we can re-invite.
        # Delete the old row so the unique constraint doesn't block the new insert.
        db.delete(stale)
        db.flush()

    invitation = BlueprintInvitation(
        blueprint_id=blueprint_id,
        slot_id=slot_id,
        sender_id=sender.id,
        receiver_id=receiver_id,
        status=BlueprintInvitationStatus.PENDING,
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITATION_TTL_DAYS),
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation


def accept_invitation(db: Session, invitation_id: uuid.UUID, user: User) -> BlueprintInvitation:
    invitation = (
        db.query(BlueprintInvitation)
        .filter(BlueprintInvitation.id == invitation_id)
        .first()
    )
    if not invitation:
        raise BlueprintInviteError("Invitation not found")
    if invitation.receiver_id != user.id:
        raise BlueprintInviteError("This invitation was not sent to you")

    # Check expiry before allowing accept
    if _expire_if_needed(invitation):
        db.commit()
        raise BlueprintInviteError("This invitation has expired")

    if invitation.status != BlueprintInvitationStatus.PENDING:
        raise BlueprintInviteError("Invitation is not pending")

    # Lock the slot to prevent double-fill
    slot = (
        db.query(BlueprintSlot)
        .filter(BlueprintSlot.id == invitation.slot_id)
        .with_for_update()
        .first()
    )
    if not slot:
        raise BlueprintInviteError("Slot not found")
    if slot.status != SlotStatus.OPEN:
        raise BlueprintInviteError("This slot has already been filled by someone else")

    slot.status = SlotStatus.FILLED
    invitation.status = BlueprintInvitationStatus.ACCEPTED

    db.add(
        BlueprintMember(
            blueprint_id=invitation.blueprint_id,
            user_id=user.id,
            slot_id=slot.id,
            role=BlueprintMemberRole.MEMBER,
        )
    )

    blueprint = (
        db.query(Blueprint)
        .filter(Blueprint.id == invitation.blueprint_id)
        .with_for_update()
        .first()
    )
    db.flush()

    all_filled = all(s.status != SlotStatus.OPEN for s in blueprint.slots)
    blueprint.status = BlueprintStatus.FULL if all_filled else BlueprintStatus.FORMING

    db.commit()
    db.refresh(invitation)
    return invitation


def reject_invitation(db: Session, invitation_id: uuid.UUID, user: User) -> BlueprintInvitation:
    invitation = (
        db.query(BlueprintInvitation)
        .filter(BlueprintInvitation.id == invitation_id)
        .first()
    )
    if not invitation:
        raise BlueprintInviteError("Invitation not found")
    if invitation.receiver_id != user.id:
        raise BlueprintInviteError("This invitation was not sent to you")
    if invitation.status != BlueprintInvitationStatus.PENDING:
        raise BlueprintInviteError("Invitation is not pending")

    invitation.status = BlueprintInvitationStatus.REJECTED
    db.commit()
    db.refresh(invitation)
    return invitation


def cancel_invitation(db: Session, invitation_id: uuid.UUID, owner: User) -> BlueprintInvitation:
    """Allow the blueprint owner to retract a pending invitation they sent."""
    invitation = (
        db.query(BlueprintInvitation)
        .filter(BlueprintInvitation.id == invitation_id)
        .first()
    )
    if not invitation:
        raise BlueprintInviteError("Invitation not found")

    blueprint = (
        db.query(Blueprint).filter(Blueprint.id == invitation.blueprint_id).first()
    )
    if not blueprint or blueprint.owner_id != owner.id:
        raise BlueprintInviteError("Only the blueprint owner can cancel invitations")

    if invitation.status != BlueprintInvitationStatus.PENDING:
        raise BlueprintInviteError("Only pending invitations can be cancelled")

    invitation.status = BlueprintInvitationStatus.CANCELLED
    db.commit()
    db.refresh(invitation)
    return invitation


def list_my_invitations(db: Session, user_id: uuid.UUID) -> List[BlueprintInvitation]:
    """Return all invitations for the given user, expiring stale ones on the fly."""
    invitations = (
        db.query(BlueprintInvitation)
        .filter(BlueprintInvitation.receiver_id == user_id)
        .order_by(BlueprintInvitation.created_at.desc())
        .all()
    )
    changed = False
    for inv in invitations:
        if _expire_if_needed(inv):
            changed = True
    if changed:
        db.commit()
    return invitations
