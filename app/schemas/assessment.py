from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
import uuid

from app.models.assessment import AssessmentStatus


# ── Question (returned to frontend) ───────────────────────────
class QuestionOut(BaseModel):
    id: str
    type: str                           # fill_in_code | debug | mcq | predict_output
    skills_tested: list[str]
    time_limit: int                     # seconds
    question: str
    code_snippet: Optional[str] = None
    options: Optional[dict[str, str]] = None  # mcq only: {a:.., b:.., c:.., d:..}
    # NOTE: correct_answer + explanation are NOT sent to frontend during assessment
    #       they are stored server-side and used by the evaluator


# ── Start response ─────────────────────────────────────────────
class AssessmentStartOut(BaseModel):
    session_id: uuid.UUID
    experience_level: str
    questions: list[QuestionOut]
    total_questions: int = 7


# ── Submit payload ─────────────────────────────────────────────
class AnswerIn(BaseModel):
    question_id: str
    user_answer: str


class AssessmentSubmitIn(BaseModel):
    session_id: uuid.UUID
    answers: list[AnswerIn]


# ── Skill result ───────────────────────────────────────────────
class SkillResult(BaseModel):
    name: str
    confidence_score: float
    confidence_level: str               # low | medium | high
    evidence_text: str


# ── Results response ───────────────────────────────────────────
class AssessmentResultOut(BaseModel):
    session_id: uuid.UUID
    status: AssessmentStatus
    experience_level: str
    skills: list[SkillResult] = []
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Session summary (list view) ────────────────────────────────
class AssessmentSessionOut(BaseModel):
    id: uuid.UUID
    status: AssessmentStatus
    experience_level: str
    started_at: datetime
    submitted_at: Optional[datetime]
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}
