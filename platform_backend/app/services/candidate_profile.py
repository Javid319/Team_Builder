"""Repository/service layer for the Candidate Profile aggregation table.

Pure data-access CRUD against candidate_profiles. profile_data follows a
flexible 5-section skeleton:
    {"evidence": {}, "ability": {}, "behavior": {}, "teamwork": {}, "availability": {}}

profile_strength (0-100) is ALWAYS derived from profile_data via
calculate_profile_strength() — every create/update path recomputes it, so the
value can never drift out of sync with the stored data.
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

# Big Five keys — used to recognise legacy behavior dicts ({dimension: score}).
_BIG_FIVE_KEYS = {
    "openness",
    "conscientiousness",
    "extraversion",
    "agreeableness",
    "neuroticism",
}


# --------------------------------------------------------------------------- #
# Strength calculation
# --------------------------------------------------------------------------- #
def _ability_stats(ability: Any) -> tuple[int, float]:
    """Return (skill_count, avg_confidence) for either profile_data shape.

    Canonical shape:  ability.skills = [{name, confidence_score, ...}]
    Legacy shape:     ability = {skill_name: confidence_score}
    """
    if not isinstance(ability, dict):
        return 0, 0.0

    skills = ability.get("skills")
    if isinstance(skills, list) and skills:
        confs = [
            s.get("confidence_score")
            for s in skills
            if isinstance(s, dict)
        ]
        confs = [c for c in confs if isinstance(c, (int, float))]
        avg = sum(confs) / len(confs) if confs else 0.0
        return len(skills), avg

    # Legacy dict shape — everything that is not a metadata key is a skill.
    meta = {"skills", "sources", "skill_count"}
    values = [
        v for k, v in ability.items()
        if k not in meta and isinstance(v, (int, float))
    ]
    if not values:
        return 0, 0.0
    return len(values), sum(values) / len(values)


def _evidence_count(evidence: Any) -> int:
    """Number of evidence records, for either shape.

    Canonical shape:  evidence.items = [...]
    Legacy shape:     evidence = {skill_name: confidence_score}
    """
    if not isinstance(evidence, dict):
        return 0
    items = evidence.get("items")
    if isinstance(items, list):
        return len(items)
    meta = {"items", "count"}
    return len([k for k in evidence if k not in meta])


def _behavior_score(behavior: Any) -> float:
    """Points for a completed personality section (max 15)."""
    if not isinstance(behavior, dict):
        return 0.0

    score = 0.0
    big_five = behavior.get("big_five")
    if isinstance(big_five, dict):
        if any(
            isinstance(v, (int, float)) and v > 0
            for v in big_five.values()
        ):
            score += 10
    elif any(
        k in _BIG_FIVE_KEYS and isinstance(v, (int, float)) and v > 0
        for k, v in behavior.items()
    ):
        score += 10

    if behavior.get("work_style") or behavior.get("communication_style"):
        score += 5
    return score


def _teamwork_score(teamwork: Any) -> float:
    """Points for a completed collaboration section (max 15)."""
    if not isinstance(teamwork, dict):
        return 0.0

    dims = teamwork.get("dimension_scores")
    if isinstance(dims, list) and dims:
        return 15.0
    # Legacy dict shape — e.g. {"leadership": 75.0, "communication": 80.0}.
    if any(
        k not in ("dimension_scores", "completed_at")
        and isinstance(v, (int, float))
        for k, v in teamwork.items()
    ):
        return 15.0
    return 0.0


def calculate_profile_strength(profile_data: Optional[Dict[str, Any]]) -> int:
    """Derive a 0-100 strength score from profile_data.

    Rubric (max 100):
        role + experience           10
        ability (breadth + conf)    35
        evidence                    15
        availability                10
        behavior (personality)      15
        teamwork (collaboration)    15

    Robust to both the canonical list shapes (ability.skills, evidence.items,
    teamwork.dimension_scores) and the legacy dict shapes written by older
    sync paths ({skill: score}, {dimension: percentage}).
    """
    if not isinstance(profile_data, dict) or not profile_data:
        return 0

    score = 0.0

    # Role & experience (10)
    role = (profile_data.get("role") or {}).get("role") or ""
    if role and role != "unknown":
        score += 5
    experience = (profile_data.get("experience") or {}).get("level") or ""
    if experience and experience != "unknown":
        score += 5

    # Ability (35): 20 for breadth (6+ skills = full), 15 scaled by confidence.
    skill_count, avg_conf = _ability_stats(profile_data.get("ability"))
    score += min(20.0, skill_count * (20.0 / 6.0))
    score += (avg_conf / 100.0) * 15.0

    # Evidence (15): 4+ records = full.
    score += min(15.0, _evidence_count(profile_data.get("evidence")) * 3.75)

    # Availability (10).
    availability = profile_data.get("availability")
    if isinstance(availability, dict):
        if availability.get("working_days"):
            score += 4
        if availability.get("working_hours"):
            score += 2
        if availability.get("timezone"):
            score += 2
        if availability.get("commitment_level"):
            score += 2

    # Behavior (15) + teamwork (15).
    score += _behavior_score(profile_data.get("behavior"))
    score += _teamwork_score(profile_data.get("teamwork"))

    return max(0, min(100, round(score)))


def _refresh_strength(profile: CandidateProfile) -> None:
    """Recompute profile_strength from the row's current profile_data."""
    profile.profile_strength = calculate_profile_strength(profile.profile_data)


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
) -> CandidateProfile:
    """Create a candidate profile for a user.

    profile_data defaults to the 5-section skeleton; profile_strength is
    computed from profile_data via calculate_profile_strength().
    """
    data = _seed_profile_data(profile_data)
    profile = CandidateProfile(
        user_id=user_id,
        profile_data=data,
        profile_strength=calculate_profile_strength(data),
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_candidate_profile(
    db: Session,
    user_id: uuid.UUID,
    profile_data: Optional[Dict[str, Any]] = None,
) -> Optional[CandidateProfile]:
    """
    Partially update a candidate profile. profile_data is shallow-merged into
    the stored data at the top level (sections), so updating only "evidence"
    preserves "ability", "behavior", etc. profile_strength is recomputed from
    the merged profile_data. Returns None if the row is missing.
    """
    profile = get_candidate_profile(db, user_id)
    if not profile:
        return None

    if profile_data is not None:
        merged = dict(profile.profile_data or {})
        for key, value in profile_data.items():
            merged[key] = value
        profile.profile_data = merged

    _refresh_strength(profile)

    db.commit()
    db.refresh(profile)
    return profile


def upsert_candidate_profile(
    db: Session,
    user_id: uuid.UUID,
    profile_data: Optional[Dict[str, Any]] = None,
) -> CandidateProfile:
    """Create the row if missing, otherwise shallow-merge update it.

    profile_strength is recomputed from profile_data in both paths.
    """
    existing = get_candidate_profile(db, user_id)
    if existing:
        updated = update_candidate_profile(db, user_id, profile_data)
        assert updated is not None  # existing was found above
        return updated
    return create_candidate_profile(db, user_id, profile_data)


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

    _refresh_strength(profile)
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

    _refresh_strength(profile)
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

    _refresh_strength(profile)
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

    _refresh_strength(profile)
    db.commit()
    db.refresh(profile)
    return profile
