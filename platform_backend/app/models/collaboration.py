import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, DateTime, Enum as SAEnum, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.db.base_class import Base


class CollaborationDimension(str, enum.Enum):
    LEADERSHIP     = "LEADERSHIP"
    COMMUNICATION  = "COMMUNICATION"
    COLLABORATION  = "COLLABORATION"
    RELIABILITY    = "RELIABILITY"
    ADAPTABILITY   = "ADAPTABILITY"
    INITIATIVE     = "INITIATIVE"


class CollaborationStatus(str, enum.Enum):
    STARTED   = "STARTED"
    COMPLETED = "COMPLETED"


class CollaborationQuestion(Base):
    __tablename__ = "collaboration_questions"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question   = Column(String(500), nullable=False)
    dimension  = Column(SAEnum(CollaborationDimension), nullable=False)
    active     = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    answers = relationship("CollaborationAnswer", back_populates="question")


class CollaborationAssessment(Base):
    __tablename__ = "collaboration_assessments"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    profile_id   = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    status       = Column(SAEnum(CollaborationStatus), default=CollaborationStatus.STARTED, nullable=False)
    started_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    scores_json  = Column(Text, nullable=True)

    answers = relationship("CollaborationAnswer", back_populates="assessment",
                           cascade="all, delete-orphan")
    assigned_questions = relationship(
        "CollaborationAssessmentQuestion",
        back_populates="assessment",
        cascade="all, delete-orphan",
    )


class CollaborationAssessmentQuestion(Base):
    """The immutable question set assigned to one assessment attempt."""
    __tablename__ = "collaboration_assessment_questions"

    assessment_id = Column(UUID(as_uuid=True), ForeignKey("collaboration_assessments.id", ondelete="CASCADE"), primary_key=True)
    question_id = Column(UUID(as_uuid=True), ForeignKey("collaboration_questions.id", ondelete="RESTRICT"), primary_key=True)

    assessment = relationship("CollaborationAssessment", back_populates="assigned_questions")
    question = relationship("CollaborationQuestion")


class CollaborationAnswer(Base):
    __tablename__ = "collaboration_answers"

    __table_args__ = (
        UniqueConstraint("assessment_id", "question_id", name="uq_collaboration_answer_assessment_question"),
    )

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True),
                           ForeignKey("collaboration_assessments.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    question_id   = Column(UUID(as_uuid=True),
                           ForeignKey("collaboration_questions.id", ondelete="CASCADE"),
                           nullable=False)
    response      = Column(Integer, nullable=False)   # 1–5 Likert
    answered_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    assessment = relationship("CollaborationAssessment", back_populates="answers")
    question   = relationship("CollaborationQuestion",   back_populates="answers")
