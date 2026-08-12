"""
Member discovery (Looking for Members)
======================================
GET /api/v1/recommendations/members — ranked candidate recommendations for a team.

Requires authentication; the caller must be a member of the team they are
discovering for.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.team import MemberRecommendation
from app.services.recommendations import NotTeamMemberError, recommend_members
from app.services.team import TeamNotFoundError, get_active_membership

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get(
    "/members",
    response_model=list[MemberRecommendation],
    summary="Recommend members for a team",
)
def members_recommendation(
    team_id: Optional[uuid.UUID] = Query(
        None, description="Team to discover members for."
    ),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return candidates ranked by domain match, assessment compatibility, and
    skill compatibility. Excludes the team's current members, users already in
    a FULL team, and users with a PENDING invitation for this team.

    When `team_id` is omitted, the caller's active team is used.
    """
    if team_id is None:
        membership = get_active_membership(db, current_user.id)
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are not part of any active team",
            )
        team_id = membership.team_id

    try:
        return recommend_members(db, team_id, current_user, limit=limit)
    except TeamNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )
    except NotTeamMemberError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a member of this team to discover candidates",
        )
