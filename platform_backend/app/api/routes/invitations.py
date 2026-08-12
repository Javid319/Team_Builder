"""
Invitation routes
==================
GET  /api/v1/my-invitations           — all invitations received by the user
POST /api/v1/invitations/{id}/accept  — accept a PENDING invitation
POST /api/v1/invitations/{id}/reject  — reject a PENDING invitation

All routes require authentication. Sending invitations lives on the teams
router (POST /teams/{team_id}/invite).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.team import InvitationOut
from app.services.invitations import (
    AlreadyMemberError,
    InvitationNotPendingError,
    InvitationNotFoundError,
    NotInvitationReceiverError,
    ReceiverInActiveTeamError,
    TeamFullError,
    TeamNotFoundError,
    accept_invitation,
    build_invitation_out,
    list_invitations,
    reject_invitation,
)

router = APIRouter(tags=["Invitations"])


@router.get(
    "/my-invitations",
    response_model=list[InvitationOut],
    summary="List the current user's invitations",
)
def my_invitations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All invitations received by the current user, newest first."""
    invitations = list_invitations(db, current_user.id)
    return [build_invitation_out(db, invitation) for invitation in invitations]


@router.post(
    "/invitations/{invitation_id}/accept",
    response_model=InvitationOut,
    summary="Accept an invitation",
)
def accept(
    invitation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a PENDING invitation and join the team as a member."""
    try:
        invitation = accept_invitation(db, invitation_id, current_user)
    except InvitationNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )
    except NotInvitationReceiverError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation was not sent to you",
        )
    except InvitationNotPendingError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invitation is not pending",
        )
    except TeamNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    except TeamFullError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Team is already full",
        )
    except AlreadyMemberError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this team",
        )
    except ReceiverInActiveTeamError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already part of another active team",
        )
    return build_invitation_out(db, invitation)


@router.post(
    "/invitations/{invitation_id}/reject",
    response_model=InvitationOut,
    summary="Reject an invitation",
)
def reject(
    invitation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject a PENDING invitation."""
    try:
        invitation = reject_invitation(db, invitation_id, current_user)
    except InvitationNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found",
        )
    except NotInvitationReceiverError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation was not sent to you",
        )
    except InvitationNotPendingError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invitation is not pending",
        )
    return build_invitation_out(db, invitation)
