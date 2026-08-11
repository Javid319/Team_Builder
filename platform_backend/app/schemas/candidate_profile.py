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
