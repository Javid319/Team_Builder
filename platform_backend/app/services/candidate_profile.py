"""Repository/service layer for the Candidate Profile aggregation table.

Pure data-access CRUD against candidate_profiles. Aggregation logic does not
live here — callers pass the profile_data dict and optional profile_strength.
profile_data follows a flexible 5-section skeleton:
    {"evidence": {}, "ability": {}, "behavior": {}, "teamwork": {}, "availability": {}}
"""
import uuid
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.candidate_profile import CandidateProfile
from app.utils.skill_normalizer import SKILL_SECTIONS, normalize_skill_map

# Canonical skeleton used when no profile_data is supplied.
DEFAULT_PROFILE_DATA: Dict[str, Any] = {
    "evidence": {},
    "ability": {},
    "behavior": {},
    "teamwork": {},
    "availability": {},
}


def _seed_profile_data(profile_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Return the provided data or a fresh copy of the 5-section skeleton."""
    if profile_data is None:
        return {key: {} for key in DEFAULT_PROFILE_DATA}
    return profile_data


def get_candidate_profile(db: Session, user_id: uuid.UUID) -> Optional[CandidateProfile]:
    """Fetch the candidate profile for a user, or None if it does not exist."""
    return (
        db.query(CandidateProfile)
        .filter(CandidateProfile.user_id == user_id)
        .first()
    )


def create_candidate_profile(
    db: Session,
    user_id: uuid.UUID,
    profile_data: Optional[Dict[str, Any]] = None,
    profile_strength: int = 0,
) -> CandidateProfile:
    """Create a candidate profile for a user. profile_data defaults to the 5-section skeleton."""
    profile = CandidateProfile(
        user_id=user_id,
        profile_data=_seed_profile_data(profile_data),
        profile_strength=profile_strength,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_candidate_profile(
    db: Session,
    user_id: uuid.UUID,
    profile_data: Optional[Dict[str, Any]] = None,
    profile_strength: Optional[int] = None,
) -> Optional[CandidateProfile]:
    """
    Partially update a candidate profile. profile_data is shallow-merged into
    the stored data at the top level (sections), so updating only "evidence"
    preserves "ability", "behavior", etc. Returns None if the row is missing.
    """
    profile = get_candidate_profile(db, user_id)
    if not profile:
        return None

    if profile_data is not None:
        merged = dict(profile.profile_data or {})
        for key, value in profile_data.items():
            merged[key] = value
        profile.profile_data = merged

    if profile_strength is not None:
        profile.profile_strength = profile_strength

    db.commit()
    db.refresh(profile)
    return profile


def upsert_candidate_profile(
    db: Session,
    user_id: uuid.UUID,
    profile_data: Optional[Dict[str, Any]] = None,
    profile_strength: Optional[int] = None,
) -> CandidateProfile:
    """Create the row if missing, otherwise shallow-merge update it."""
    existing = get_candidate_profile(db, user_id)
    if existing:
        updated = update_candidate_profile(db, user_id, profile_data, profile_strength)
        assert updated is not None  # existing was found above
        return updated
    return create_candidate_profile(
        db, user_id,
        profile_data=profile_data,
        profile_strength=profile_strength if profile_strength is not None else 0,
    )


def delete_candidate_profile(db: Session, user_id: uuid.UUID) -> bool:
    """Delete the candidate profile for a user. Returns True if a row was removed."""
    profile = get_candidate_profile(db, user_id)
    if not profile:
        return False
    db.delete(profile)
    db.commit()
    return True


def _merge_section_scores(
    db: Session,
    user_id: uuid.UUID,
    section: str,
    scores: Dict[str, float],
) -> CandidateProfile:
    """Merge {skill_name: confidence_score} into one profile_data section.

    Creates the candidate profile row if missing; preserves existing entries.
    """
    profile = get_candidate_profile(db, user_id)
    if profile is None:
        profile = create_candidate_profile(db, user_id)

    current = dict(profile.profile_data or {})
    merged = dict(current.get(section) or {})

    if section in SKILL_SECTIONS:
        merged = normalize_skill_map(merged)
        scores = normalize_skill_map(scores)

    for name, score in scores.items():
        merged[name] = score if isinstance(score, (int, float)) else float(score)
    current[section] = merged
    profile.profile_data = current

    db.commit()
    db.refresh(profile)
    return profile


def update_ability_from_assessment(
    db: Session,
    user_id: uuid.UUID,
    skill_scores: Dict[str, float],
) -> CandidateProfile:
    """
    Store assessment results into profile_data.ability as {skill_name: score}.

    Creates the candidate profile row if it does not exist yet. Existing
    ability entries are preserved; new scores are merged in. Assessment
    results are only ever written to the candidate profile — never to the
    skills table.
    """
    return _merge_section_scores(db, user_id, "ability", skill_scores)


def update_evidence_from_verification(
    db: Session,
    user_id: uuid.UUID,
    skill_scores: Dict[str, float],
) -> CandidateProfile:
    """
    Store GitHub-verified skill confidence into profile_data.evidence as
    {skill_name: confidence_score}.

    The skills table itself is left untouched here — that is owned by the
    resume verification flow. This only mirrors the verification confidence
    into the candidate profile. Creates the candidate profile row if missing.
    """
    return _merge_section_scores(db, user_id, "evidence", skill_scores)


def update_behavior_from_personality(
    db: Session,
    user_id: uuid.UUID,
    scores: Dict[str, int],
) -> CandidateProfile:
    """
    Store personality dimension scores into profile_data.behavior as
    {dimension: score} (e.g. {"openness": 72, "conscientiousness": 84}).

    Creates the candidate profile row if missing. Existing entries preserved.
    """
    return _merge_section_scores(db, user_id, "behavior", scores)


def update_teamwork_from_collaboration(
    db: Session,
    user_id: uuid.UUID,
    scores: Dict[str, float],
) -> CandidateProfile:
    """
    Store collaboration dimension percentages into profile_data.teamwork as
    {dimension: percentage} (e.g. {"leadership": 80, "communication": 75}).

    Creates the candidate profile row if missing. Existing entries preserved.
    """
    return _merge_section_scores(db, user_id, "teamwork", scores)


def update_availability_from_profile(
    db: Session,
    user_id: uuid.UUID,
    availability: Dict[str, Any],
) -> CandidateProfile:
    """
    Store availability details into profile_data.availability (working_days,
    working_hours, timezone, commitment_level). Values are stored as-is
    (strings/lists/enum values); None values are skipped.

    Creates the candidate profile row if missing. Existing entries preserved.
    """
    profile = get_candidate_profile(db, user_id)
    if profile is None:
        profile = create_candidate_profile(db, user_id)

    current = dict(profile.profile_data or {})
    merged = dict(current.get("availability") or {})
    for key, value in availability.items():
        if value is not None:
            merged[key] = value
    current["availability"] = merged
    profile.profile_data = current

    db.commit()
    db.refresh(profile)
    return profile


def update_experience_from_profile(
    db: Session,
    user_id: uuid.UUID,
    level: Optional[str],
) -> CandidateProfile:
    """
    Store the profile's experience level into profile_data.experience as
    {"level": "beginner" | "intermediate" | "experienced"}.

    A missing/null level is stored as "unknown". Creates the candidate
    profile row if missing.
    """
    profile = get_candidate_profile(db, user_id)
    if profile is None:
        profile = create_candidate_profile(db, user_id)

    current = dict(profile.profile_data or {})
    current["experience"] = {"level": level or "unknown"}
    profile.profile_data = current

    db.commit()
    db.refresh(profile)
    return profile


def update_role_from_profile(
    db: Session,
    user_id: uuid.UUID,
    role: Optional[str],
) -> CandidateProfile:
    """
    Store the profile's role into profile_data.role as
    {"role": "backend_developer" | ...}.

    The role is only ever taken from the profiles table — it is never
    inferred from skills or any other source. A missing/null role is stored
    as "unknown". Creates the candidate profile row if missing.
    """
    profile = get_candidate_profile(db, user_id)
    if profile is None:
        profile = create_candidate_profile(db, user_id)

    current = dict(profile.profile_data or {})
    current["role"] = {"role": role or "unknown"}
    profile.profile_data = current

    db.commit()
    db.refresh(profile)
    return profile
