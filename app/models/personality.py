import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, SmallInteger, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Personality(Base):
    """
    Optional personality & collaboration assessment results.
    Scalar dimension scores use SmallInteger (0–100).
    AI analysis fields store free-form text / JSON strings.
    """
    __tablename__ = "personality"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    profile_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # Raw responses stored as JSON string (assessment answers)
    raw_responses = Column(Text, nullable=True)

    # Dimension scores (0–100), written by the AI module
    openness_score = Column(SmallInteger, nullable=True)
    conscientiousness_score = Column(SmallInteger, nullable=True)
    extraversion_score = Column(SmallInteger, nullable=True)
    agreeableness_score = Column(SmallInteger, nullable=True)
    neuroticism_score = Column(SmallInteger, nullable=True)

    # Qualitative AI-generated analysis
    work_style = Column(String(100), nullable=True)          # e.g. "Independent", "Collaborative"
    communication_style = Column(String(100), nullable=True) # e.g. "Async", "Sync"
    preferred_role = Column(String(100), nullable=True)      # e.g. "Leader", "Contributor"
    strengths = Column(Text, nullable=True)                  # JSON string list
    collaboration_notes = Column(Text, nullable=True)        # free-form AI summary

    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship
    profile = relationship("Profile", back_populates="personality")
