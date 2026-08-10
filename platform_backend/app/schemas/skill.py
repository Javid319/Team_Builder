from pydantic import BaseModel, Field
from typing import Optional
import uuid

from app.models.skill import ConfidenceLevel


class SkillCreate(BaseModel):
    name: str
    level: ConfidenceLevel  # beginner | intermediate | advanced


class SkillOut(BaseModel):
    id: uuid.UUID
    name: str
    # DB column is confidence_level — alias it to "level" for the API response
    level: Optional[ConfidenceLevel] = Field(None, alias="confidence_level")

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }
