from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

# Direct import avoids circular issues with models/__init__.py
from app.models.profile import ExperienceLevel
from app.schemas.availability import AvailabilityCreate, AvailabilityOut
from app.schemas.project import ProjectOut
from app.schemas.skill import SkillOut
from app.schemas.personality import PersonalityOut


# ── Create ────────────────────────────────────────────────────
class ProfileCreate(BaseModel):
    name: Optional[str] = None            # defaults to the user's signup full name
    college: Optional[str] = None
    degree: Optional[str] = None
    course: Optional[str] = None
    department: Optional[str] = None
    year_of_study: Optional[int] = None
    state: Optional[str] = None
    city: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    leetcode_url: Optional[str] = None
    experience_level: Optional[ExperienceLevel] = None
    role: Optional[str] = None           # e.g. backend_developer, ml_engineer, other
    availability: Optional[AvailabilityCreate] = None   # nested, created together


# ── Update (all fields optional) ─────────────────────────────
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    course: Optional[str] = None
    department: Optional[str] = None
    year_of_study: Optional[int] = None
    state: Optional[str] = None
    city: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    leetcode_url: Optional[str] = None
    experience_level: Optional[ExperienceLevel] = None
    role: Optional[str] = None
    availability: Optional[AvailabilityCreate] = None


# ── Full profile response ─────────────────────────────────────
class ProfileOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    college: Optional[str]
    degree: Optional[str]
    course: Optional[str]
    department: Optional[str]
    year_of_study: Optional[int]
    state: Optional[str]
    city: Optional[str]
    github_url: Optional[str]
    linkedin_url: Optional[str]
    leetcode_url: Optional[str]
    avatar_url: Optional[str] = None
    experience_level: Optional[ExperienceLevel]
    role: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Nested
    availability: Optional[AvailabilityOut] = None
    projects: List[ProjectOut] = []
    skills: List[SkillOut] = []
    personality: Optional[PersonalityOut] = None

    model_config = {"from_attributes": True}
