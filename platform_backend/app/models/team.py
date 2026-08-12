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


class TeamStatus(str, enum.Enum):
    OPEN   = "OPEN"    # actively recruiting
    FULL   = "FULL"    # member capacity reached
    LOCKED = "LOCKED"  # no longer active (archived/settled)


class TeamMemberRole(str, enum.Enum):
    OWNER  = "OWNER"
    MEMBER = "MEMBER"


class InvitationStatus(str, enum.Enum):
    PENDING   = "PENDING"
    ACCEPTED  = "ACCEPTED"
    REJECTED  = "REJECTED"
    CANCELLED = "CANCELLED"


class JoinRequestStatus(str, enum.Enum):
    PENDING  = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


class Team(Base):
    """A team for the Regular Team Formation flow."""
    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    domains = Column(ARRAY(String(50)), nullable=False, default=list)
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    max_members = Column(Integer, nullable=False, default=4)
    status = Column(SAEnum(TeamStatus), default=TeamStatus.OPEN, nullable=False)
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
    owner = relationship(
        "User", back_populates="owned_teams", foreign_keys=[owner_id]
    )
    members = relationship(
        "TeamMember", back_populates="team", cascade="all, delete-orphan"
    )
    invitations = relationship(
        "TeamInvitation", back_populates="team", cascade="all, delete-orphan"
    )
    join_requests = relationship(
        "TeamJoinRequest", back_populates="team", cascade="all, delete-orphan"
    )


class TeamMember(Base):
    """Membership row linking a user to a team (owner is also a member)."""
    __tablename__ = "team_members"

    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_members_team_user"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    team_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(SAEnum(TeamMemberRole), default=TeamMemberRole.MEMBER, nullable=False)
    joined_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")


class TeamInvitation(Base):
    """Invite from a team member (sender) to a prospective member (receiver)."""
    __tablename__ = "team_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    team_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
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
    status = Column(
        SAEnum(InvitationStatus), default=InvitationStatus.PENDING, nullable=False
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    team = relationship("Team", back_populates="invitations")
    sender = relationship(
        "User", back_populates="sent_invitations", foreign_keys=[sender_id]
    )
    receiver = relationship(
        "User", back_populates="received_invitations", foreign_keys=[receiver_id]
    )


class TeamJoinRequest(Base):
    """A user asking to join a team."""
    __tablename__ = "team_join_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    team_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(
        SAEnum(JoinRequestStatus), default=JoinRequestStatus.PENDING, nullable=False
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    team = relationship("Team", back_populates="join_requests")
    user = relationship("User", back_populates="join_requests")
