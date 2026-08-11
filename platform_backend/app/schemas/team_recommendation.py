from pydantic import BaseModel
from datetime import datetime
from typing import List
import uuid


class RecommendationContent(BaseModel):
    """The AI-generated team recommendation report body."""
    summary: str = ""
    strengths: List[str] = []
    improvements: List[str] = []
    ideal_roles: List[str] = []
    tips: List[str] = []


class TeamRecommendationOut(BaseModel):
    id: uuid.UUID
    content: RecommendationContent
    created_at: datetime

    model_config = {"from_attributes": True}
