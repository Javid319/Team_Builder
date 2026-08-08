from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
import uuid


class PersonalityCreate(BaseModel):
    """Submitted by the user when completing the optional assessment."""
    raw_responses: Optional[str] = None     # JSON string of answers


class PersonalityAIUpdate(BaseModel):
    """
    Written by the AI module after analysing raw_responses.
    SmallInteger scores must be 0–100.
    """
    openness_score: Optional[int] = None
    conscientiousness_score: Optional[int] = None
    extraversion_score: Optional[int] = None
    agreeableness_score: Optional[int] = None
    neuroticism_score: Optional[int] = None

    work_style: Optional[str] = None
    communication_style: Optional[str] = None
    preferred_role: Optional[str] = None
    strengths: Optional[str] = None            # JSON string list
    collaboration_notes: Optional[str] = None
    completed_at: Optional[datetime] = None

    @field_validator(
        "openness_score",
        "conscientiousness_score",
        "extraversion_score",
        "agreeableness_score",
        "neuroticism_score",
    )
    @classmethod
    def score_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (0 <= v <= 100):
            raise ValueError("Score must be between 0 and 100")
        return v


class PersonalityOut(BaseModel):
    id: uuid.UUID
    raw_responses: Optional[str]
    openness_score: Optional[int]
    conscientiousness_score: Optional[int]
    extraversion_score: Optional[int]
    agreeableness_score: Optional[int]
    neuroticism_score: Optional[int]
    work_style: Optional[str]
    communication_style: Optional[str]
    preferred_role: Optional[str]
    strengths: Optional[str]
    collaboration_notes: Optional[str]
    completed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}
