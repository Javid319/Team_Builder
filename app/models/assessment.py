import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.db.base_class import Base


class AssessmentStatus(str, enum.Enum):
    pending   = "pending"    # questions generated, not yet submitted
    submitted = "submitted"  # answers submitted, awaiting Groq evaluation
    completed = "completed"  # Groq evaluation done, skills written
    failed    = "failed"     # Groq call failed


class AssessmentSession(Base):
    """
    One row per assessment attempt.
    questions_json  — Groq-generated questions (JSON string)
    answers_json    — user's submitted answers (JSON string)
    result_json     — Groq evaluation output: skills + confidence scores (JSON string)
    """
    __tablename__ = "assessment_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    experience_level = Column(String(50), nullable=False)
    status = Column(SAEnum(AssessmentStatus), default=AssessmentStatus.pending, nullable=False)

    questions_json = Column(Text, nullable=True)   # JSON array of question objects
    answers_json   = Column(Text, nullable=True)   # JSON array of {question_id, answer}
    result_json    = Column(Text, nullable=True)   # JSON array of {name, score, level, evidence}

    started_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
