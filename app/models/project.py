import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.db.base_class import Base


class ProjectSource(str, enum.Enum):
    resume = "resume"         # extracted from resume (AI module)
    github = "github"         # pulled from GitHub (AI module)
    manual = "manual"         # user entered manually


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    profile_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )

    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    technologies = Column(Text, nullable=True)      # JSON string — AI module writes this
    github_repo_url = Column(String(500), nullable=True)
    source = Column(SAEnum(ProjectSource), default=ProjectSource.manual, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship
    profile = relationship("Profile", back_populates="projects")
