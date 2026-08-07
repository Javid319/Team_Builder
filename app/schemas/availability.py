from pydantic import BaseModel
from typing import Optional, List
import uuid

from app.models.availability import CommitmentLevel


class AvailabilityCreate(BaseModel):
    # List of day names, e.g. ["Mon", "Tue", "Wed"]
    working_days: Optional[List[str]] = None
    working_hours: Optional[str] = None     # e.g. "09:00-18:00"
    timezone: Optional[str] = None          # e.g. "Asia/Kolkata"
    commitment_level: Optional[CommitmentLevel] = None


class AvailabilityUpdate(AvailabilityCreate):
    pass


class AvailabilityOut(BaseModel):
    id: uuid.UUID
    working_days: Optional[List[str]]
    working_hours: Optional[str]
    timezone: Optional[str]
    commitment_level: Optional[CommitmentLevel]

    model_config = {"from_attributes": True}
