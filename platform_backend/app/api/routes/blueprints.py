from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
import uuid

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.blueprint import (
    Blueprint,
    BlueprintSlot,
    BlueprintSlotSkill,
    BlueprintMember,
    BlueprintMemberRole,
    BlueprintInvitation,
    BlueprintInvitationStatus,
    BlueprintJoinRequestStatus,
    SlotStatus,
)
from app.models.profile import Profile
from app.schemas.blueprint import (
    BlueprintCreate,
    BlueprintOut,
    BlueprintRecommendationsResponse,
    BlueprintInviteRequest,
    BlueprintInvitationOut,
    BlueprintDashboardOut,
    BlueprintDashboardOutExtended,
    BlueprintJoinRequestOut,
    BlueprintListOut,
    JoinRequestAcceptPayload,
    BlueprintMineOut,
)
from app.services.blueprint_recommendations import recommend_for_blueprint
from app.services.blueprint_invitations import (
    create_invitation,
    accept_invitation,
    reject_invitation,
    cancel_invitation,
    list_my_invitations,
    BlueprintInviteError,
)
from app.services.blueprint_join_requests import (
    create_join_request,
    accept_join_request,
    reject_join_request,
    list_blueprints_for_discovery,
    lock_blueprint,
    BlueprintJoinError,
)

router = APIRouter(prefix="/blueprints", tags=["Blueprints"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _inv_out(inv: BlueprintInvitation, **extras) -> BlueprintInvitationOut:
    return BlueprintInvitationOut(
        id=inv.id,
        blueprint_id=inv.blueprint_id,
        slot_id=inv.slot_id,
        sender_id=inv.sender_id,
        receiver_id=inv.receiver_id,
        status=inv.status.value,
        created_at=inv.created_at,
        **extras,
    )


# ── Static / prefix-specific routes MUST come before /{blueprint_id}/... ─────

@router.get("/mine", response_model=List[BlueprintMineOut])
def get_my_blueprints(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all blueprints owned by the current user."""
    blueprints = (
        db.query(Blueprint)
        .filter(Blueprint.owner_id == current_user.id)
        .order_by(Blueprint.created_at.desc())
        .all()
    )
    outs = []
    for bp in blueprints:
        open_slots = sum(1 for s in bp.slots if s.status == SlotStatus.OPEN)
        roles = list({s.role for s in bp.slots if s.status == SlotStatus.OPEN})
        outs.append(
            BlueprintMineOut(
                id=bp.id,
                name=bp.name,
                description=bp.description,
                hackathon_id=bp.hackathon_id,
                domains=bp.domains or [],
                status=bp.status.value,
                member_count=len(bp.members),
                open_slots=open_slots,
                roles_needed=roles,
                created_at=bp.created_at,
            )
        )
    return outs


@router.get("/my-invitations", response_model=List[BlueprintInvitationOut])
def my_invitations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invs = list_my_invitations(db, current_user.id)
    return [
        _inv_out(
            inv,
            blueprint_name=inv.blueprint.name if inv.blueprint else None,
            slot_role=inv.slot.role if inv.slot else None,
            sender_name=inv.sender.full_name if inv.sender else None,
        )
        for inv in invs
    ]


@router.get("", response_model=List[BlueprintListOut])
def get_blueprints(
    hackathon_id: str,
    db: Session = Depends(get_db),
):
    bps = list_blueprints_for_discovery(db, hackathon_id)
    outs = []
    for bp in bps:
        open_slots = sum(1 for s in bp.slots if s.status == SlotStatus.OPEN)
        roles = list({s.role for s in bp.slots if s.status == SlotStatus.OPEN})
        outs.append(
            BlueprintListOut(
                id=bp.id,
                name=bp.name,
                description=bp.description,
                hackathon_id=bp.hackathon_id,
                domains=bp.domains or [],
                status=bp.status.value,
                member_count=len(bp.members),
                open_slots=open_slots,
                roles_needed=roles,
            )
        )
    return outs


@router.post("", response_model=BlueprintOut, status_code=status.HTTP_201_CREATED)
def create_blueprint(
    payload: BlueprintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        blueprint = Blueprint(
            hackathon_id=payload.hackathon_id,
            owner_id=current_user.id,
            name=payload.name,
            description=payload.description,
            domains=payload.domains,
        )
        db.add(blueprint)
        db.flush()

        for slot_data in payload.slots:
            slot = BlueprintSlot(
                blueprint_id=blueprint.id,
                role=slot_data.role,
                slot_order=slot_data.slot_order,
            )
            db.add(slot)
            db.flush()
            for skill_name in slot_data.skills:
                db.add(BlueprintSlotSkill(slot_id=slot.id, name=skill_name))

        db.add(
            BlueprintMember(
                blueprint_id=blueprint.id,
                user_id=current_user.id,
                role=BlueprintMemberRole.OWNER,
            )
        )

        db.commit()
        db.refresh(blueprint)
        return blueprint

    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="A blueprint with these details already exists.")
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(e))


# ── Invitation static-path routes (must come before /{blueprint_id}/...) ─────

@router.post("/invitations/{invitation_id}/accept", response_model=BlueprintInvitationOut)
def accept_invite(
    invitation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        inv = accept_invitation(db, invitation_id, current_user)
        return _inv_out(inv)
    except BlueprintInviteError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invitations/{invitation_id}/reject", response_model=BlueprintInvitationOut)
def reject_invite(
    invitation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        inv = reject_invitation(db, invitation_id, current_user)
        return _inv_out(inv)
    except BlueprintInviteError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/invitations/{invitation_id}/cancel", response_model=BlueprintInvitationOut)
def cancel_invite(
    invitation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Owner cancels a pending invitation they sent."""
    try:
        inv = cancel_invitation(db, invitation_id, current_user)
        return _inv_out(inv)
    except BlueprintInviteError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Join-request static-path routes (must come before /{blueprint_id}/...) ───

@router.post("/join-requests/{request_id}/accept", response_model=BlueprintJoinRequestOut)
def accept_join_req(
    request_id: uuid.UUID,
    payload: JoinRequestAcceptPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        req = accept_join_request(db, request_id, payload.slot_id, current_user)
        return BlueprintJoinRequestOut(
            id=req.id,
            blueprint_id=req.blueprint_id,
            user_id=req.user_id,
            status=req.status.value,
            created_at=req.created_at,
        )
    except BlueprintJoinError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/join-requests/{request_id}/reject", response_model=BlueprintJoinRequestOut)
def reject_join_req(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        req = reject_join_request(db, request_id, current_user)
        return BlueprintJoinRequestOut(
            id=req.id,
            blueprint_id=req.blueprint_id,
            user_id=req.user_id,
            status=req.status.value,
            created_at=req.created_at,
        )
    except BlueprintJoinError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── /{blueprint_id}/... routes ────────────────────────────────────────────────

@router.get("/{blueprint_id}/recommendations", response_model=List[BlueprintRecommendationsResponse])
def get_blueprint_recommendations(
    blueprint_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return recommend_for_blueprint(
            db=db,
            blueprint_id=blueprint_id,
            requester=current_user,
            limit_per_slot=10,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{blueprint_id}/invite", response_model=BlueprintInvitationOut)
def invite_candidate(
    blueprint_id: uuid.UUID,
    payload: BlueprintInviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        inv = create_invitation(
            db=db,
            blueprint_id=blueprint_id,
            slot_id=payload.slot_id,
            sender=current_user,
            receiver_id=payload.receiver_id,
        )
        return _inv_out(inv)
    except BlueprintInviteError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="An invitation to this candidate for this slot already exists. Cancel the existing one before re-inviting.",
        )


@router.get("/{blueprint_id}/dashboard", response_model=BlueprintDashboardOutExtended)
def get_dashboard(
    blueprint_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    blueprint = db.query(Blueprint).filter(Blueprint.id == blueprint_id).first()
    if not blueprint:
        raise HTTPException(status_code=404, detail="Blueprint not found")

    # Authorization: only members (owner or members) can view the dashboard
    membership = (
        db.query(BlueprintMember)
        .filter(
            BlueprintMember.blueprint_id == blueprint_id,
            BlueprintMember.user_id == current_user.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this blueprint.")

    members = []
    for m in blueprint.members:
        prof = db.query(Profile).filter(Profile.user_id == m.user_id).first()
        name = prof.name if prof else m.user.full_name
        members.append(
            {
                "user_id": m.user_id,
                "name": name,
                "role": m.role.value,
                "slot_role": m.slot.role if m.slot else None,
            }
        )

    slots = []
    for s in blueprint.slots:
        slots.append(
            {
                "id": s.id,
                "role": s.role,
                "status": s.status.value,
                "skills": [sk.name for sk in s.preferred_skills],
            }
        )

    pending_invites = []
    for i in blueprint.invitations:
        if i.status == BlueprintInvitationStatus.PENDING:
            prof = db.query(Profile).filter(Profile.user_id == i.receiver_id).first()
            # blueprint_name field is repurposed here to carry receiver_name for the dashboard UI
            receiver_name = prof.name if prof else (i.receiver.full_name if i.receiver else "Unknown")
            pending_invites.append(
                {
                    "id": i.id,
                    "blueprint_id": i.blueprint_id,
                    "slot_id": i.slot_id,
                    "sender_id": i.sender_id,
                    "receiver_id": i.receiver_id,
                    "status": i.status.value,
                    "created_at": i.created_at,
                    "slot_role": i.slot.role if i.slot else None,
                    "sender_name": i.sender.full_name if i.sender else None,
                    "blueprint_name": receiver_name,
                }
            )

    pending_join_requests = []
    for req in blueprint.join_requests:
        if req.status == BlueprintJoinRequestStatus.PENDING:
            prof = db.query(Profile).filter(Profile.user_id == req.user_id).first()
            name = prof.name if prof else (req.user.full_name if req.user else "Unknown")
            pending_join_requests.append(
                {
                    "id": req.id,
                    "blueprint_id": req.blueprint_id,
                    "user_id": req.user_id,
                    "status": req.status.value,
                    "created_at": req.created_at,
                    "user_name": name,
                    "blueprint_name": blueprint.name,
                }
            )

    return {
        "id": blueprint.id,
        "name": blueprint.name,
        "status": blueprint.status.value,
        "members": members,
        "slots": slots,
        "pending_invitations": pending_invites,
        "pending_join_requests": pending_join_requests,
    }


@router.post("/{blueprint_id}/join-requests", response_model=BlueprintJoinRequestOut)
def request_to_join(
    blueprint_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        req = create_join_request(db, blueprint_id, current_user)
        return BlueprintJoinRequestOut(
            id=req.id,
            blueprint_id=req.blueprint_id,
            user_id=req.user_id,
            status=req.status.value,
            created_at=req.created_at,
        )
    except BlueprintJoinError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{blueprint_id}/lock")
def lock_team(
    blueprint_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        lock_blueprint(db, blueprint_id, current_user)
        return {"detail": "Blueprint locked"}
    except BlueprintJoinError as e:
        raise HTTPException(status_code=400, detail=str(e))
