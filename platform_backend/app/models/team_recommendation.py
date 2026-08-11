import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class TeamRecommendation(Base):
    """
    AI-generated team recommendation report for a user (one per user).

    The report is produced by Groq from the user's profile, personality
    assessment and collaboration assessment. `content` mirrors the
    RecommendationContent schema:
      summary, strengths, improvements, ideal_roles, tips
    """
    __tablename__ = "team_recommendations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    content = Column(JSONB, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User")
