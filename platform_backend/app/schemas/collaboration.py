"""
Pydantic schemas for the Collaboration Assessment module.

Design notes:
- Question text and dimension are returned to the frontend on /start.
- Responses are stored as integers 1–5 (Strongly Disagree → Strongly Agree).
- Dimension scores and the full per-dimension breakdown are computed
  server-side and stored; they are never shown raw to the user.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.collaboration import CollaborationDimension, CollaborationStatus


# ── Response scale constant (for documentation purposes) ─────
#   1 = Strongly Disagree
#   2 = Disagree
#   3 = Neutral
#   4 = Agree
#   5 = Strongly Agree
LIKERT_MIN = 1
LIKERT_MAX = 5


# ── Question returned to the frontend ────────────────────────

class CollaborationQuestionOut(BaseModel):
    """A single question shown to the participant."""
    id: uuid.UUID
    question: str
    dimension: CollaborationDimension   # kept so the frontend can show a category label if desired

    model_config = {"from_attributes": True}


# ── Start response ────────────────────────────────────────────

class CollaborationStartOut(BaseModel):
    """Returned when a participant begins the assessment."""
    assessment_id: uuid.UUID
    questions: list[CollaborationQuestionOut]
    total_questions: int = 12


# ── Submit payload ────────────────────────────────────────────

class CollaborationAnswerIn(BaseModel):
    """A single question–response pair submitted by the participant."""
    question_id: uuid.UUID
    response: int = Field(..., ge=LIKERT_MIN, le=LIKERT_MAX)

    @field_validator("response")
    @classmethod
    def validate_likert(cls, v: int) -> int:
        if v not in range(LIKERT_MIN, LIKERT_MAX + 1):
            raise ValueError(f"Response must be between {LIKERT_MIN} and {LIKERT_MAX}")
        return v


class CollaborationSubmitIn(BaseModel):
    """Full submission payload — one entry per question."""
    assessment_id: uuid.UUID
    answers: list[CollaborationAnswerIn] = Field(..., min_length=12, max_length=12)


# ── Per-dimension score (internal, stored in DB / used by matching) ──

class DimensionScore(BaseModel):
    """Score for a single collaboration dimension (computed server-side)."""
    dimension: CollaborationDimension
    raw_score: int          # sum of Likert responses for this dimension (2–10)
    max_score: int = 10     # 2 questions × max 5
    percentage: float       # 0.0 – 100.0


# ── Results response ──────────────────────────────────────────

class CollaborationResultOut(BaseModel):
    """
    Returned after a successful submission.
    Dimension scores are included so the backend can use them for team matching,
    but the frontend may choose to display only a summary message.
    """
    assessment_id: uuid.UUID
    status: CollaborationStatus
    started_at: datetime
    completed_at: Optional[datetime]
    dimension_scores: list[DimensionScore] = []

    model_config = {"from_attributes": True}


# ── Session summary (list view) ───────────────────────────────

class CollaborationSessionOut(BaseModel):
    """Brief summary of one assessment attempt."""
    id: uuid.UUID
    status: CollaborationStatus
    started_at: datetime
    completed_at: Optional[datetime]

    model_config = {"from_attributes": True}
