import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, ForeignKey, DateTime,
    Enum as SAEnum, Numeric,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.db.base_class import Base


class SkillSource(str, enum.Enum):
    resume = "resume"           # AI extracted from resume
    github = "github"           # AI detected from GitHub repos
    assessment = "assessment"   # scenario-based assessment
    manual = "manual"           # user declared


class ConfidenceLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Skill(Base):
    __tablename__ = "skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    profile_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )

    name = Column(String(255), nullable=False)          # e.g. "FastAPI", "React"
    category = Column(String(100), nullable=True)       # e.g. "Backend", "Frontend", "ML"
    source = Column(SAEnum(SkillSource), default=SkillSource.manual, nullable=False)

    # Numeric(5,2) → values 0.00 – 100.00 (or 0.00 – 1.00, your choice)
    confidence_score = Column(Numeric(5, 2), nullable=True)
    confidence_level = Column(SAEnum(ConfidenceLevel), nullable=True)

    # Relationships
    profile = relationship("Profile", back_populates="skills")
    evidence = relationship(
        "SkillEvidence",
        back_populates="skill",
        cascade="all, delete-orphan",
    )


class SkillEvidence(Base):
    """
    One or more evidence records backing a Skill's confidence score.
    Populated by the Skill Confidence Engine AI module.
    """
    __tablename__ = "skill_evidence"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    skill_id = Column(
        UUID(as_uuid=True),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Where the evidence was found
    source_type = Column(SAEnum(SkillSource), nullable=False)
    source_url = Column(String(1000), nullable=True)    # GitHub repo URL, etc.

    # What the AI found
    evidence_text = Column(Text, nullable=True)         # snippet / commit message / etc.
    weight = Column(Numeric(5, 2), nullable=True)       # contribution to overall score

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship
    skill = relationship("Skill", back_populates="evidence")
