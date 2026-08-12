"""
Candidate browsing routes
==========================
GET /api/v1/candidates — list candidates for the Regular Team Formation flow.

Filter semantics match the frontend: AND across filter groups, OR within a
group. All filtering is done with PostgreSQL JSONB operators on the
candidate_profiles.profile_data column, so no dedicated query columns are
needed.

    role=backend_developer,frontend_developer
    skills=python,react
    experience=beginner,intermediate
    availability=part_time,full_time      (commitment_level)
    search=<free text over name, college, skills>
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.candidate_profile import CandidateProfile
from app.models.profile import Profile
from app.models.user import User
from app.schemas.candidate_profile import CandidateListItem

router = APIRouter(prefix="/candidates", tags=["Candidates"])


def _split(value: Optional[str]) -> List[str]:
    """Split a comma-separated query param into a cleaned list."""
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


def _build_bio(profile: Profile, data: dict) -> str:
    """Synthesize a short bio from role, experience, skills, and college.

    The profiles table has no bio column; keeping the bio server-side means
    the profile_data JSONB contract stays exactly Phase 1 (no extra keys).
    """
    role = (data.get("role") or {}).get("role") or ""
    experience = (data.get("experience") or {}).get("level") or ""
    skills = [
        s.get("name")
        for s in (data.get("ability") or {}).get("skills", [])
        if s.get("name")
    ]

    parts = []
    if role:
        parts.append(role.replace("_", " ").title())
    if experience:
        parts.append(f"{experience.title()} level")
    if skills:
        parts.append("skilled in " + ", ".join(skills[:4]))
    if profile.college:
        parts.append("from " + profile.college)

    if parts:
        return f"{profile.name} — {' '.join(parts)}."
    return f"{profile.name}'s profile."


@router.get(
    "",
    response_model=List[CandidateListItem],
    summary="Browse candidates for team formation",
)
def list_candidates(
    role: Optional[str] = Query(
        None, description="Comma-separated roles to include (OR)."
    ),
    skills: Optional[str] = Query(
        None, description="Comma-separated skill names to include (OR)."
    ),
    experience: Optional[str] = Query(
        None, description="Comma-separated experience levels (OR)."
    ),
    availability: Optional[str] = Query(
        None, description="Comma-separated commitment levels (OR)."
    ),
    search: Optional[str] = Query(
        None, description="Free-text search over name, college, city, skills."
    ),
    db: Session = Depends(get_db),
) -> List[CandidateListItem]:
    """
    List candidates (candidate_profiles joined with profiles/users) sorted by
    profile_strength. Filter groups are AND-ed; values within a group are OR-ed.
    """
    roles = _split(role)
    skill_names = _split(skills)
    experience_levels = _split(experience)
    commitment_levels = _split(availability)

    query = (
        db.query(CandidateProfile, Profile, User)
        .join(Profile, Profile.user_id == CandidateProfile.user_id)
        .join(User, User.id == CandidateProfile.user_id)
        # Only rows following the Phase 1 ability.skills[] shape — legacy
        # rows written as {skill: score} dicts are not browsable.
        .filter(CandidateProfile.profile_data["ability"].has_key("skills"))
    )

    if roles:
        query = query.filter(
            or_(*[
                CandidateProfile.profile_data["role"]["role"].astext == r
                for r in roles
            ])
        )

    if experience_levels:
        query = query.filter(
            or_(*[
                CandidateProfile.profile_data["experience"]["level"].astext == lv
                for lv in experience_levels
            ])
        )

    if commitment_levels:
        query = query.filter(
            or_(*[
                CandidateProfile.profile_data["availability"]["commitment_level"].astext
                == c
                for c in commitment_levels
            ])
        )

    if skill_names:
        # JSONB array containment: ability.skills contains an item with this name.
        query = query.filter(
            or_(*[
                CandidateProfile.profile_data["ability"]["skills"].contains(
                    [{"name": name}]
                )
                for name in skill_names
            ])
        )

    if search:
        q = search.strip()
        if q:
            query = query.filter(
                or_(
                    Profile.name.ilike(f"%{q}%"),
                    Profile.college.ilike(f"%{q}%"),
                    Profile.city.ilike(f"%{q}%"),
                    cast(CandidateProfile.profile_data, String).ilike(f"%{q}%"),
                )
            )

    rows = query.order_by(CandidateProfile.profile_strength.desc()).all()

    return [
        CandidateListItem(
            id=candidate.id,
            name=profile.name,
            avatar_url=profile.avatar_url,
            college=profile.college,
            city=profile.city,
            github_url=profile.github_url,
            bio=_build_bio(profile, candidate.profile_data or {}),
            profile_data=candidate.profile_data or {},
            profile_strength=candidate.profile_strength or 0,
        )
        for candidate, profile, _user in rows
    ]
