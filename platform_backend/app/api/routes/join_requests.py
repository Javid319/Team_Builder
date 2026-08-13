"""
Join request management routes
=============================
POST /api/v1/join-requests/{id}/accept  — accept a PENDING join request
POST /api/v1/join-requests/{id}/reject  — reject a PENDING join request

All routes require authentication and can only be used by the owner of the
request's team. Creating requests lives on the teams router
(POST /teams/{team_id}/join-request). Listing the current user's own
requests lives on the my_requests router (GET /my-join-requests).
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.team import JoinRequestOut
from app.services.join_requests import (
    AlreadyInActiveTeamError,
    AlreadyMemberError,
    JoinRequestNotPendingError,
    JoinRequestNotFoundError,
    NotTeamOwnerError,
    TeamFullError,
    TeamNotFoundError,
    accept_join_request,
    build_join_request_out,
    reject_join_request,
)

router = APIRouter(prefix="/join-requests", tags=["Join Requests"])


@router.post(
    "/{join_request_id}/accept",
    response_model=JoinRequestOut,
    summary="Accept a join request",
)
def accept(
    join_request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a PENDING join request; the requester joins as a MEMBER."""
    try:
        join_request = accept_join_request(db, join_request_id, current_user)
    except JoinRequestNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Join request not found",
        )
    except NotTeamOwnerError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team owner can manage join requests",
        )
    except JoinRequestNotPendingError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Join request is not pending",
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
            detail="User is already a member of this team",
        )
    except AlreadyInActiveTeamError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already part of another active team",
        )
    return build_join_request_out(db, join_request)


@router.post(
    "/{join_request_id}/reject",
    response_model=JoinRequestOut,
    summary="Reject a join request",
)
def reject(
    join_request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject a PENDING join request."""
    try:
        join_request = reject_join_request(db, join_request_id, current_user)
    except JoinRequestNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Join request not found",
        )
    except NotTeamOwnerError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the team owner can manage join requests",
        )
    except JoinRequestNotPendingError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Join request is not pending",
        )
    return build_join_request_out(db, join_request)
