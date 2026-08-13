import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    ForeignKey,
    DateTime,
    Enum as SAEnum,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class BlueprintStatus(str, enum.Enum):
    OPEN = "OPEN"
    FORMING = "FORMING"
    FULL = "FULL"
    LOCKED = "LOCKED"


class Blueprint(Base):
    __tablename__ = "blueprints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    # String to support both UUID-based and string-based hackathon IDs (mock data uses "hack_001" etc.)
    hackathon_id = Column(String(255), nullable=False, index=True)
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    domains = Column(ARRAY(String(50)), nullable=False, default=list)
    status = Column(SAEnum(BlueprintStatus), default=BlueprintStatus.OPEN, nullable=False)
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
    owner = relationship("User", back_populates="owned_blueprints")
    slots = relationship("BlueprintSlot", back_populates="blueprint", cascade="all, delete-orphan")
    members = relationship("BlueprintMember", back_populates="blueprint", cascade="all, delete-orphan")
    invitations = relationship("BlueprintInvitation", back_populates="blueprint", cascade="all, delete-orphan")
    join_requests = relationship("BlueprintJoinRequest", back_populates="blueprint", cascade="all, delete-orphan")


class SlotStatus(str, enum.Enum):
    OPEN = "OPEN"
    FILLED = "FILLED"


class BlueprintSlot(Base):
    __tablename__ = "blueprint_slots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    blueprint_id = Column(
        UUID(as_uuid=True),
        ForeignKey("blueprints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(255), nullable=False)
    slot_order = Column(Integer, nullable=False, default=0)
    status = Column(SAEnum(SlotStatus), default=SlotStatus.OPEN, nullable=False)

    # Relationships
    blueprint = relationship("Blueprint", back_populates="slots")
    preferred_skills = relationship("BlueprintSlotSkill", back_populates="slot", cascade="all, delete-orphan")


class BlueprintSlotSkill(Base):
    __tablename__ = "blueprint_slot_skills"

    __table_args__ = (
        UniqueConstraint("slot_id", "name", name="uq_blueprint_slot_skill"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    slot_id = Column(
        UUID(as_uuid=True),
        ForeignKey("blueprint_slots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Storing skill name as string (Option A from plan)
    name = Column(String(255), nullable=False)

    # Relationships
    slot = relationship("BlueprintSlot", back_populates="preferred_skills")


class BlueprintMemberRole(str, enum.Enum):
    OWNER = "OWNER"
    MEMBER = "MEMBER"


class BlueprintMember(Base):
    __tablename__ = "blueprint_members"

    __table_args__ = (
        UniqueConstraint("blueprint_id", "user_id", name="uq_blueprint_member_user"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    blueprint_id = Column(
        UUID(as_uuid=True),
        ForeignKey("blueprints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slot_id = Column(
        UUID(as_uuid=True),
        ForeignKey("blueprint_slots.id", ondelete="CASCADE"),
        nullable=True,  # Owner might not occupy a specific slot
        index=True,
    )
    role = Column(SAEnum(BlueprintMemberRole), default=BlueprintMemberRole.MEMBER, nullable=False)
    joined_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    blueprint = relationship("Blueprint", back_populates="members")
    user = relationship("User", back_populates="blueprint_memberships")
    slot = relationship("BlueprintSlot")


class BlueprintInvitationStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class BlueprintInvitation(Base):
    __tablename__ = "blueprint_invitations"

    __table_args__ = (
        # Ensure only one active/pending invitation exists for a specific slot and receiver
        # It's tricky to constrain just PENDING, so typically we might just avoid dupes entirely 
        # or leave it to business logic. But let's add a general one.
        UniqueConstraint("blueprint_id", "receiver_id", "slot_id", name="uq_blueprint_invitation"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    blueprint_id = Column(
        UUID(as_uuid=True),
        ForeignKey("blueprints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slot_id = Column(
        UUID(as_uuid=True),
        ForeignKey("blueprint_slots.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    sender_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    receiver_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(SAEnum(BlueprintInvitationStatus), default=BlueprintInvitationStatus.PENDING, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    blueprint = relationship("Blueprint", back_populates="invitations")
    slot = relationship("BlueprintSlot")
    sender = relationship("User", back_populates="sent_blueprint_invitations", foreign_keys=[sender_id])
    receiver = relationship("User", back_populates="received_blueprint_invitations", foreign_keys=[receiver_id])


class BlueprintJoinRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class BlueprintJoinRequest(Base):
    __tablename__ = "blueprint_join_requests"

    __table_args__ = (
        UniqueConstraint("blueprint_id", "user_id", name="uq_blueprint_join_request_user"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    blueprint_id = Column(
        UUID(as_uuid=True),
        ForeignKey("blueprints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(SAEnum(BlueprintJoinRequestStatus), default=BlueprintJoinRequestStatus.PENDING, nullable=False)
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
    blueprint = relationship("Blueprint", back_populates="join_requests")
    user = relationship("User", back_populates="blueprint_join_requests")
