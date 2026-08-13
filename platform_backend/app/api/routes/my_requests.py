"""
My-request routes
=================
GET /api/v1/my-join-requests — all join requests the current user has sent.

Requires authentication. Used by the "Looking to Join a Team" flow to show
the status of a user's requests across teams.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.team import JoinRequestOut
from app.services.join_requests import build_join_request_out, list_my_join_requests

router = APIRouter(tags=["My Requests"])


@router.get(
    "/my-join-requests",
    response_model=list[JoinRequestOut],
    summary="List the current user's join requests",
)
def my_join_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All join requests sent by the current user, newest first."""
    requests = list_my_join_requests(db, current_user.id)
    return [build_join_request_out(db, request) for request in requests]
