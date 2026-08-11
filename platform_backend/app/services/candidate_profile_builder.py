"""
CandidateProfileBuilder — read-only aggregation service.

Pulls a developer's existing data (skills, personality, collaboration
assessments, availability) into the canonical 5-section candidate
profile_data shape:

    {
        "evidence":     {...},
        "ability":      {...},
        "behavior":     {...},
        "teamwork":     {...},
        "availability": {...}
    }

Constraints (by design):
- Read-only: never writes to the database.
- Does not modify existing business logic or tables.
- No AI calls, no recommendation logic, no role inference.
- Sections with no source data are emitted as empty objects {}.

Each section is represented by a strongly-typed frozen dataclass; use
`CandidateProfileBuildResult.to_profile_data()` to get the JSON-ready dict.
"""
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.availability import Availability
from app.models.collaboration import CollaborationAssessment, CollaborationStatus
from app.models.personality import Personality
from app.models.profile import Profile
from app.models.skill import Skill, SkillEvidence
from app.utils.skill_normalizer import normalize_skill_name

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Strongly-typed section containers
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class SkillItem:
    name: str
    category: Optional[str]
    source: str
    confidence_score: Optional[float]
    confidence_level: Optional[str]


@dataclass(frozen=True)
class EvidenceItem:
    skill_name: str
    source_type: str
    source_url: Optional[str]
    evidence_text: Optional[str]
    weight: Optional[float]


@dataclass(frozen=True)
class AbilitySection:
    """Snapshot of the developer's declared/detected skills."""
    skills: List[SkillItem] = field(default_factory=list)
    sources: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "skills": [
                {
                    "name": item.name,
                    "category": item.category,
                    "source": item.source,
                    "confidence_score": item.confidence_score,
                    "confidence_level": item.confidence_level,
                }
                for item in self.skills
            ],
            "sources": self.sources,
            "skill_count": len(self.skills),
        }


@dataclass(frozen=True)
class EvidenceSection:
    """Evidence records backing skill confidence scores."""
    items: List[EvidenceItem] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "items": [
                {
                    "skill": item.skill_name,
                    "source_type": item.source_type,
                    "source_url": item.source_url,
                    "evidence_text": item.evidence_text,
                    "weight": item.weight,
                }
                for item in self.items
            ],
            "count": len(self.items),
        }


@dataclass(frozen=True)
class PersonalitySection:
    """Big Five scores and qualitative personality analysis."""
    openness_score: Optional[int]
    conscientiousness_score: Optional[int]
    extraversion_score: Optional[int]
    agreeableness_score: Optional[int]
    neuroticism_score: Optional[int]
    work_style: Optional[str]
    communication_style: Optional[str]
    preferred_role: Optional[str]
    strengths: List[str] = field(default_factory=list)
    collaboration_notes: Optional[str] = None
    completed_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "big_five": {
                "openness": self.openness_score,
                "conscientiousness": self.conscientiousness_score,
                "extraversion": self.extraversion_score,
                "agreeableness": self.agreeableness_score,
                "neuroticism": self.neuroticism_score,
            },
            "work_style": self.work_style,
            "communication_style": self.communication_style,
            "preferred_role": self.preferred_role,
            "strengths": self.strengths,
            "collaboration_notes": self.collaboration_notes,
            "completed_at": _isoformat(self.completed_at),
        }


@dataclass(frozen=True)
class DimensionScore:
    dimension: str
    raw_score: int
    max_score: int
    percentage: float


@dataclass(frozen=True)
class TeamworkSection:
    """Dimension scores from the latest completed collaboration assessment."""
    dimension_scores: List[DimensionScore] = field(default_factory=list)
    completed_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dimension_scores": [
                {
                    "dimension": score.dimension,
                    "raw_score": score.raw_score,
                    "max_score": score.max_score,
                    "percentage": score.percentage,
                }
                for score in self.dimension_scores
            ],
            "completed_at": _isoformat(self.completed_at),
        }


@dataclass(frozen=True)
class AvailabilitySection:
    working_days: Optional[List[str]]
    working_hours: Optional[str]
    timezone: Optional[str]
    commitment_level: Optional[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "working_days": self.working_days,
            "working_hours": self.working_hours,
            "timezone": self.timezone,
            "commitment_level": self.commitment_level,
        }


@dataclass(frozen=True)
class ExperienceSection:
    """Profile experience level (beginner / intermediate / experienced)."""
    level: str = "unknown"

    def to_dict(self) -> Dict[str, Any]:
        return {"level": self.level}


@dataclass(frozen=True)
class RoleSection:
    """Profile role (backend_developer, ml_engineer, ...). Missing -> "unknown"."""
    role: str = "unknown"

    def to_dict(self) -> Dict[str, Any]:
        return {"role": self.role}


@dataclass(frozen=True)
class CandidateProfileBuildResult:
    """Fully-typed aggregation of every source section."""
    evidence: Optional[EvidenceSection]
    ability: Optional[AbilitySection]
    behavior: Optional[PersonalitySection]
    teamwork: Optional[TeamworkSection]
    availability: Optional[AvailabilitySection]
    experience: Optional[ExperienceSection] = None
    role: Optional[RoleSection] = None

    def to_profile_data(self) -> Dict[str, Any]:
        """JSON-ready candidate profile_data. Missing sections become {}."""
        return {
            "evidence": self.evidence.to_dict() if self.evidence else {},
            "ability": self.ability.to_dict() if self.ability else {},
            "behavior": self.behavior.to_dict() if self.behavior else {},
            "teamwork": self.teamwork.to_dict() if self.teamwork else {},
            "availability": self.availability.to_dict() if self.availability else {},
            "experience": self.experience.to_dict() if self.experience else {"level": "unknown"},
            "role": self.role.to_dict() if self.role else {"role": "unknown"},
        }


# --------------------------------------------------------------------------- #
# Builder entry points
# --------------------------------------------------------------------------- #
def build_for_user(db: Session, user_id: uuid.UUID) -> Optional[CandidateProfileBuildResult]:
    """Build a candidate profile for a user. Returns None if the user has no profile."""
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        return None
    return build_candidate_profile(db, profile.id)


def build_candidate_profile(db: Session, profile_id: uuid.UUID) -> CandidateProfileBuildResult:
    """Aggregate all source tables for the given profile into a typed result."""
    return CandidateProfileBuildResult(
        evidence=_build_evidence(db, profile_id),
        ability=_build_ability(db, profile_id),
        behavior=_build_behavior(db, profile_id),
        teamwork=_build_teamwork(db, profile_id),
        availability=_build_availability(db, profile_id),
        experience=_build_experience(db, profile_id),
        role=_build_role(db, profile_id),
    )


# --------------------------------------------------------------------------- #
# Section builders (read-only)
# --------------------------------------------------------------------------- #
def _build_ability(db: Session, profile_id: uuid.UUID) -> Optional[AbilitySection]:
    rows = (
        db.query(Skill)
        .filter(Skill.profile_id == profile_id)
        .order_by(Skill.name.asc())
        .all()
    )
    if not rows:
        return None

    skills: List[SkillItem] = []
    sources = set()
    for skill in rows:
        sources.add(skill.source.value if skill.source else "manual")
        skills.append(
            SkillItem(
                name=normalize_skill_name(skill.name),
                category=skill.category,
                source=skill.source.value if skill.source else "manual",
                confidence_score=_as_float(skill.confidence_score),
                confidence_level=skill.confidence_level.value if skill.confidence_level else None,
            )
        )
    return AbilitySection(skills=skills, sources=sorted(sources))


def _build_evidence(db: Session, profile_id: uuid.UUID) -> Optional[EvidenceSection]:
    rows = (
        db.query(SkillEvidence, Skill.name)
        .join(Skill, Skill.id == SkillEvidence.skill_id)
        .filter(Skill.profile_id == profile_id)
        .order_by(Skill.name.asc())
        .all()
    )
    if not rows:
        return None

    items = [
        EvidenceItem(
            skill_name=normalize_skill_name(skill_name),
            source_type=evidence.source_type.value if evidence.source_type else "manual",
            source_url=evidence.source_url,
            evidence_text=evidence.evidence_text,
            weight=_as_float(evidence.weight),
        )
        for evidence, skill_name in rows
    ]
    return EvidenceSection(items=items)


def _build_behavior(db: Session, profile_id: uuid.UUID) -> Optional[PersonalitySection]:
    personality = (
        db.query(Personality)
        .filter(Personality.profile_id == profile_id)
        .first()
    )
    if not personality:
        return None

    return PersonalitySection(
        openness_score=personality.openness_score,
        conscientiousness_score=personality.conscientiousness_score,
        extraversion_score=personality.extraversion_score,
        agreeableness_score=personality.agreeableness_score,
        neuroticism_score=personality.neuroticism_score,
        work_style=personality.work_style,
        communication_style=personality.communication_style,
        preferred_role=personality.preferred_role,
        strengths=_parse_str_list(personality.strengths),
        collaboration_notes=personality.collaboration_notes,
        completed_at=personality.completed_at,
    )


def _build_teamwork(db: Session, profile_id: uuid.UUID) -> Optional[TeamworkSection]:
    assessment = (
        db.query(CollaborationAssessment)
        .filter(
            CollaborationAssessment.profile_id == profile_id,
            CollaborationAssessment.status == CollaborationStatus.COMPLETED,
        )
        .order_by(CollaborationAssessment.completed_at.desc())
        .first()
    )
    if not assessment or not assessment.scores_json:
        return None

    dimension_scores = _parse_dimension_scores(assessment.scores_json)
    if not dimension_scores:
        return None

    return TeamworkSection(
        dimension_scores=dimension_scores,
        completed_at=assessment.completed_at,
    )


def _build_availability(db: Session, profile_id: uuid.UUID) -> Optional[AvailabilitySection]:
    availability = (
        db.query(Availability)
        .filter(Availability.profile_id == profile_id)
        .first()
    )
    if not availability:
        return None

    return AvailabilitySection(
        working_days=list(availability.working_days) if availability.working_days else None,
        working_hours=availability.working_hours,
        timezone=availability.timezone,
        commitment_level=availability.commitment_level.value if availability.commitment_level else None,
    )


def _build_experience(db: Session, profile_id: uuid.UUID) -> ExperienceSection:
    """Read the profile's experience level (missing -> "unknown")."""
    level = (
        db.query(Profile.experience_level)
        .filter(Profile.id == profile_id)
        .scalar()
    )
    return ExperienceSection(level=level.value if level else "unknown")


def _build_role(db: Session, profile_id: uuid.UUID) -> RoleSection:
    """Read the profile's role directly (missing -> "unknown").

    The role is only ever taken from the profiles table — it is never
    inferred from skills or any other source.
    """
    role = (
        db.query(Profile.role)
        .filter(Profile.id == profile_id)
        .scalar()
    )
    return RoleSection(role=role or "unknown")


# --------------------------------------------------------------------------- #
# Parsing helpers
# --------------------------------------------------------------------------- #
def _parse_dimension_scores(scores_json: str) -> List[DimensionScore]:
    """Parse collaboration scores_json into typed DimensionScore objects.

    Malformed entries are skipped; returns [] when nothing usable is found.
    """
    try:
        raw = json.loads(scores_json)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Collaboration scores_json is not valid JSON: %r", scores_json[:200])
        return []

    if not isinstance(raw, list):
        return []

    scores: List[DimensionScore] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        dimension = entry.get("dimension")
        raw_score = entry.get("raw_score")
        max_score = entry.get("max_score")
        percentage = entry.get("percentage")
        if not isinstance(dimension, str) or dimension == "":
            continue
        try:
            scores.append(
                DimensionScore(
                    dimension=dimension,
                    raw_score=int(raw_score),
                    max_score=int(max_score),
                    percentage=float(percentage),
                )
            )
        except (TypeError, ValueError):
            continue
    return scores


def _parse_str_list(raw: Optional[str]) -> List[str]:
    """Parse a JSON-string-encoded list (e.g. personality strengths) safely."""
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return []
    if isinstance(value, list):
        return [str(item) for item in value if item]
    return []


def _as_float(value: Any) -> Optional[float]:
    """Convert Numeric/Decimal/float to float, or None."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _isoformat(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None
