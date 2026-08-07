import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Resume(Base):
    """
    Stores one uploaded resume per row.
    A user can upload multiple versions; is_current flags the active one.
    The Resume Intelligence AI module reads file_path to parse the document.
    """
    __tablename__ = "resumes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    original_filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)    # server-side path after upload
    content_type = Column(String(100), nullable=True)   # e.g. "application/pdf"

    # Only one resume should be current at a time; enforced in application logic
    is_current = Column(Boolean, default=True, nullable=False)

    # AI-parsed content (populated by Resume Intelligence module)
    parsed_text = Column(Text, nullable=True)
    parse_status = Column(String(50), nullable=True)    # "pending" | "done" | "error"

    uploaded_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship
    user = relationship("User", back_populates="resumes")
