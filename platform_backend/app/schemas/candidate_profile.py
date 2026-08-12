from pydantic import BaseModel
from datetime import datetime
from typing import Any, Dict, Optional
import uuid


class CandidateProfileCreate(BaseModel):
    """Payload for creating a candidate profile row."""
    user_id: uuid.UUID
    profile_data: Optional[Dict[str, Any]] = None   # falls back to the 5-section skeleton
    profile_strength: int = 0


class CandidateProfileUpdate(BaseModel):
    """Payload for updating a candidate profile row (partial updates supported)."""
    profile_data: Optional[Dict[str, Any]] = None
    profile_strength: Optional[int] = None


class CandidateProfileOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    profile_data: Dict[str, Any]
    profile_strength: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class CandidateListItem(BaseModel):
    """Candidate browse row: candidate_profiles data joined with profile fields.

    `bio` is synthesized server-side from the profile (no dedicated column).
    `profile_data` mirrors the Phase 1 contract (role, ability, behavior,
    evidence, teamwork, experience, availability).
    """
    id: uuid.UUID
    name: str
    avatar_url: Optional[str] = None
    college: Optional[str] = None
    city: Optional[str] = None
    github_url: Optional[str] = None
    bio: str
    profile_data: Dict[str, Any]
    profile_strength: int = 0
