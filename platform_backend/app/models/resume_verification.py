import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, ForeignKey, DateTime, Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class ResumeVerification(Base):
    """
    Stores the full verification result from the resume_engine /parse endpoint.

    Mirrors the github_verification payload shape from skill_verifier.verify_skills():
      status, username, matched_skills, unmatched_skills, statistics
    """
    __tablename__ = 'resume_verifications'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    resume_id = Column(
        UUID(as_uuid=True),
        ForeignKey('resumes.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )

    status = Column(String(50), nullable=False)
    github_username = Column(String(255), nullable=True)
    skip_reason = Column(String(255), nullable=True)

    resume_skills_count = Column(Integer, nullable=True)
    matched_count = Column(Integer, nullable=True)
    unmatched_count = Column(Integer, nullable=True)
    verification_percentage = Column(Numeric(5, 2), nullable=True)

    matched_skills = Column(JSONB, nullable=True)
    unmatched_skills = Column(JSONB, nullable=True)
    raw_response = Column(JSONB, nullable=True)

    verified_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    resume = relationship('Resume', backref='verification')
    user = relationship('User')
