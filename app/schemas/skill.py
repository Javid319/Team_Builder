from decimal import Decimal
from pydantic import BaseModel, field_validator
from typing import Optional, List
import uuid

from app.models.skill import SkillSource, ConfidenceLevel


class SkillEvidenceOut(BaseModel):
    id: uuid.UUID
    source_type: SkillSource
    source_url: Optional[str]
    evidence_text: Optional[str]
    weight: Optional[Decimal]

    model_config = {"from_attributes": True}


class SkillCreate(BaseModel):
    name: str
    category: Optional[str] = None
    source: SkillSource = SkillSource.manual
    confidence_score: Optional[Decimal] = None
    confidence_level: Optional[ConfidenceLevel] = None

    @field_validator("confidence_score")
    @classmethod
    def score_range(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and not (Decimal("0.00") <= v <= Decimal("100.00")):
            raise ValueError("confidence_score must be between 0.00 and 100.00")
        return v


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    confidence_score: Optional[Decimal] = None
    confidence_level: Optional[ConfidenceLevel] = None

    @field_validator("confidence_score")
    @classmethod
    def score_range(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and not (Decimal("0.00") <= v <= Decimal("100.00")):
            raise ValueError("confidence_score must be between 0.00 and 100.00")
        return v


class SkillOut(BaseModel):
    id: uuid.UUID
    name: str
    category: Optional[str]
    source: SkillSource
    confidence_score: Optional[Decimal]
    confidence_level: Optional[ConfidenceLevel]
    evidence: List[SkillEvidenceOut] = []

    model_config = {"from_attributes": True}
