"""
Pydantic schemas for the Team Formation module.

Validation rules:
- name must be non-empty (whitespace stripped)
- max_members must be within [2, 10]
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.team import (
    InvitationStatus,
    JoinRequestStatus,
    TeamStatus,
    TeamMemberRole,
)

TEAM_NAME_MAX = 255
TEAM_MIN_MEMBERS = 2
TEAM_MAX_MEMBERS = 10


# ── Create payload ─────────────────────────────────────────────
class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    domains: list[str] = Field(default_factory=list, max_length=20)
    max_members: int = Field(
        default=4,
        ge=TEAM_MIN_MEMBERS,
        le=TEAM_MAX_MEMBERS,
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Team name cannot be empty")
        if len(v) > TEAM_NAME_MAX:
            raise ValueError(f"Team name must be at most {TEAM_NAME_MAX} characters")
        return v

    @field_validator("domains")
    @classmethod
    def domains_cleaned(cls, v: list[str]) -> list[str]:
        cleaned = []
        for domain in v:
            domain = domain.strip()
            if domain and domain not in cleaned:
                cleaned.append(domain)
        return cleaned

    @field_validator("max_members")
    @classmethod
    def max_members_reasonable(cls, v: int) -> int:
        if v < TEAM_MIN_MEMBERS:
            raise ValueError("A team must have at least 2 members")
        return v


# ── Member summary (member + user info) ────────────────────────
class TeamMemberOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    role: TeamMemberRole
    joined_at: datetime
    name: Optional[str] = None
    email: Optional[str] = None


# ── Team response ──────────────────────────────────────────────
class TeamOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    domains: list[str] = []
    owner_id: uuid.UUID
    max_members: int
    status: TeamStatus
    created_at: datetime
    updated_at: datetime
    members: list[TeamMemberOut] = []
    member_count: int = 0
    owner: Optional[TeamMemberOut] = None


# ── Member recommendations (GET /recommendations/members) ──────
class MemberRecommendation(BaseModel):
    user_id: uuid.UUID
    name: str
    avatar_url: Optional[str] = None
    college: Optional[str] = None
    city: Optional[str] = None
    github_url: Optional[str] = None
    bio: str = ""
    role: str = "unknown"
    skills: list[str] = []
    experience_level: str = "unknown"
    commitment_level: str = ""
    profile_strength: int = 0
    compatibility_score: int = 0
    domain_match: list[str] = []
    assessment_compatibility: int = 0
    skill_overlap: list[str] = []


# ── Team listing (GET /teams) ─────────────────────────────────
class TeamListOwnerOut(BaseModel):
    id: uuid.UUID
    name: Optional[str] = None
    email: Optional[str] = None


class TeamListItem(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    domains: list[str] = []
    status: TeamStatus
    max_members: int
    current_size: int
    open_slots: int
    owner: Optional[TeamListOwnerOut] = None


class TeamListResponse(BaseModel):
    items: list[TeamListItem] = []
    total: int
    page: int
    page_size: int


# ── Join requests ──────────────────────────────────────────────
class JoinRequestUserOut(BaseModel):
    id: uuid.UUID
    name: Optional[str] = None
    email: Optional[str] = None
    college: Optional[str] = None
    role: Optional[str] = None


class JoinRequestTeamOut(BaseModel):
    id: uuid.UUID
    name: str
    domains: list[str] = []
    status: TeamStatus
    member_count: int = 0
    max_members: int


class JoinRequestOut(BaseModel):
    id: uuid.UUID
    team_id: uuid.UUID
    user_id: uuid.UUID
    status: JoinRequestStatus
    created_at: datetime
    team: Optional[JoinRequestTeamOut] = None
    user: Optional[JoinRequestUserOut] = None


# ── Invitations ────────────────────────────────────────────────
class InviteCreate(BaseModel):
    receiver_id: uuid.UUID


class InvitationTeamOut(BaseModel):
    id: uuid.UUID
    name: str
    domains: list[str] = []
    status: TeamStatus
    member_count: int = 0
    max_members: int


class InvitationUserOut(BaseModel):
    id: uuid.UUID
    name: Optional[str] = None
    email: Optional[str] = None


class InvitationOut(BaseModel):
    id: uuid.UUID
    team_id: uuid.UUID
    sender_id: uuid.UUID
    receiver_id: uuid.UUID
    status: InvitationStatus
    created_at: datetime
    expires_at: Optional[datetime] = None
    team: Optional[InvitationTeamOut] = None
    sender: Optional[InvitationUserOut] = None
    receiver: Optional[InvitationUserOut] = None
