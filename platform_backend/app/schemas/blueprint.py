from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator

from app.models.blueprint import (
    BlueprintStatus,
    SlotStatus,
    BlueprintMemberRole,
    BlueprintInvitationStatus,
    BlueprintJoinRequestStatus,
)

BLUEPRINT_NAME_MAX = 255


# ── Slot Schemas ───────────────────────────────────────────────
class BlueprintSlotSkillCreate(BaseModel):
    name: str

class BlueprintSlotCreate(BaseModel):
    role: str
    slot_order: int = 0
    skills: List[str] = []

class BlueprintSlotSkillOut(BaseModel):
    id: uuid.UUID
    name: str
    model_config = {"from_attributes": True}

class BlueprintSlotOut(BaseModel):
    id: uuid.UUID
    blueprint_id: uuid.UUID
    role: str
    slot_order: int
    status: SlotStatus
    preferred_skills: List[BlueprintSlotSkillOut] = []
    model_config = {"from_attributes": True}


# ── Blueprint Create Payload ───────────────────────────────────
class BlueprintCreate(BaseModel):
    hackathon_id: str   # accepts both UUID and string IDs (mock hackathons use "hack_001" etc.)
    name: str
    description: Optional[str] = None
    domains: List[str] = Field(default_factory=list, max_length=20)
    slots: List[BlueprintSlotCreate] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Blueprint name cannot be empty")
        if len(v) > BLUEPRINT_NAME_MAX:
            raise ValueError(f"Blueprint name must be at most {BLUEPRINT_NAME_MAX} characters")
        return v

    @field_validator("domains")
    @classmethod
    def domains_cleaned(cls, v: List[str]) -> List[str]:
        cleaned = []
        for domain in v:
            domain = domain.strip()
            if domain and domain not in cleaned:
                cleaned.append(domain)
        return cleaned


# ── Blueprint Member Out ───────────────────────────────────────
class BlueprintMemberOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    slot_id: Optional[uuid.UUID] = None
    role: BlueprintMemberRole
    joined_at: datetime
    model_config = {"from_attributes": True}


# ── Blueprint Out ──────────────────────────────────────────────
class BlueprintOut(BaseModel):
    id: uuid.UUID
    hackathon_id: str
    owner_id: uuid.UUID
    name: str
    description: Optional[str] = None
    domains: List[str] = []
    status: BlueprintStatus
    created_at: datetime
    updated_at: datetime
    slots: List[BlueprintSlotOut] = []
    members: List[BlueprintMemberOut] = []
    model_config = {"from_attributes": True}


# ── Blueprint Mine Out (owner's own blueprints listing) ────────
class BlueprintMineOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    hackathon_id: str
    domains: List[str] = []
    status: str
    member_count: int = 0
    open_slots: int = 0
    roles_needed: List[str] = []
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Recommendations ────────────────────────────────────────────
class SlotRecommendation(BaseModel):
    user_id: uuid.UUID
    name: str
    avatar_url: Optional[str] = None
    college: Optional[str] = None
    city: Optional[str] = None
    github_url: Optional[str] = None
    bio: str = ""
    role: str = "unknown"
    skills: List[str] = []
    experience_level: str = "unknown"
    commitment_level: str = ""
    profile_strength: int = 0
    compatibility_score: int = 0
    skill_overlap: List[str] = []

class BlueprintRecommendationsResponse(BaseModel):
    slot_id: uuid.UUID
    slot_role: str
    recommendations: List[SlotRecommendation] = []


# ── Invitations & Dashboard ────────────────────────────────────
class BlueprintInviteRequest(BaseModel):
    receiver_id: uuid.UUID
    slot_id: uuid.UUID

class BlueprintInvitationOut(BaseModel):
    id: uuid.UUID
    blueprint_id: uuid.UUID
    slot_id: Optional[uuid.UUID] = None   # nullable in DB
    sender_id: uuid.UUID
    receiver_id: uuid.UUID
    status: str
    created_at: datetime

    # Extra fields for the UI
    blueprint_name: Optional[str] = None
    slot_role: Optional[str] = None
    sender_name: Optional[str] = None
    model_config = {"from_attributes": True}

class BlueprintDashboardMember(BaseModel):
    user_id: uuid.UUID
    name: str
    role: str  # OWNER or MEMBER
    slot_role: Optional[str] = None

class BlueprintDashboardSlot(BaseModel):
    id: uuid.UUID
    role: str
    status: str
    skills: List[str]

class BlueprintDashboardOut(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    members: List[BlueprintDashboardMember] = []
    slots: List[BlueprintDashboardSlot] = []
    pending_invitations: List[BlueprintInvitationOut] = []
    model_config = {"from_attributes": True}

class BlueprintDashboardOutExtended(BlueprintDashboardOut):
    pending_join_requests: List["BlueprintJoinRequestOut"] = []


# ── Join Requests ──────────────────────────────────────────────
class BlueprintJoinRequestOut(BaseModel):
    id: uuid.UUID
    blueprint_id: uuid.UUID
    user_id: uuid.UUID
    status: str
    created_at: datetime

    # Extra fields for UI
    user_name: Optional[str] = None
    blueprint_name: Optional[str] = None
    model_config = {"from_attributes": True}

class JoinRequestAcceptPayload(BaseModel):
    slot_id: uuid.UUID


# ── Blueprint list (discovery) ─────────────────────────────────
class BlueprintListOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    hackathon_id: str
    domains: List[str] = []
    status: str
    member_count: int = 0
    open_slots: int = 0
    roles_needed: List[str] = []
    model_config = {"from_attributes": True}


# Resolve forward reference
BlueprintDashboardOutExtended.model_rebuild()
