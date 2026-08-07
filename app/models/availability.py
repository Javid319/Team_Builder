import uuid
from sqlalchemy import Column, String, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
import enum

from app.db.base_class import Base


class CommitmentLevel(str, enum.Enum):
    casual = "casual"           # a few hours/week
    part_time = "part_time"     # 10–20 hrs/week
    full_time = "full_time"     # 40+ hrs/week


class Availability(Base):
    __tablename__ = "availability"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    profile_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # PostgreSQL native array, e.g. ["Mon", "Tue", "Wed"]
    working_days = Column(ARRAY(String(10)), nullable=True)

    # e.g. "09:00-18:00"
    working_hours = Column(String(50), nullable=True)

    # e.g. "Asia/Kolkata", "UTC", "America/New_York"
    timezone = Column(String(100), nullable=True)

    commitment_level = Column(SAEnum(CommitmentLevel), nullable=True)

    # Relationship
    profile = relationship("Profile", back_populates="availability")
