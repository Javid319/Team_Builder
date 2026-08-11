import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, ForeignKey, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class CandidateProfile(Base):
    """
    Aggregation layer: a JSONB snapshot of all candidate signals
    (evidence, ability, behavior, teamwork, availability) plus a derived
    profile_strength (0–100). Kept intentionally schema-flexible so the
    aggregation logic can evolve without migrations.
    """
    __tablename__ = "candidate_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    profile_data = Column(JSONB, nullable=False, default=dict)
    profile_strength = Column(Integer, default=0, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User")
