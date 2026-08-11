import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.db.base_class import Base


class ExperienceLevel(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    experienced = "experienced"


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # Basic info
    name = Column(String(255), nullable=False)
    college = Column(String(255), nullable=True)
    degree = Column(String(255), nullable=True)
    course = Column(String(255), nullable=True)
    department = Column(String(255), nullable=True)
    year_of_study = Column(Integer, nullable=True)

    # Location
    state = Column(String(255), nullable=True)
    city = Column(String(255), nullable=True)

    # Links
    github_url = Column(String(500), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    leetcode_url = Column(String(500), nullable=True)

    # Profile picture (public URL served from /uploads/avatars)
    avatar_url = Column(String(500), nullable=True)

    # Experience
    experience_level = Column(SAEnum(ExperienceLevel), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="profile")
    availability = relationship(
        "Availability",
        back_populates="profile",
        uselist=False,
        cascade="all, delete-orphan",
    )
    projects = relationship(
        "Project",
        back_populates="profile",
        cascade="all, delete-orphan",
    )
    skills = relationship(
        "Skill",
        back_populates="profile",
        cascade="all, delete-orphan",
    )
    personality = relationship(
        "Personality",
        back_populates="profile",
        uselist=False,
        cascade="all, delete-orphan",
    )
