"""Deterministic, short-form personality assessment endpoints."""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.personality import Personality
from app.models.profile import Profile
from app.models.user import User
from app.schemas.personality import PersonalityOut, PersonalitySubmitOut

router = APIRouter(prefix="/personality", tags=["Personality Assessment"])

QUESTIONS = [
    ("openness_1", "I enjoy exploring new ideas, even when the outcome is uncertain.", "openness", False),
    ("openness_2", "I am curious about perspectives that differ from my own.", "openness", False),
    ("openness_3", "I prefer familiar approaches over experimenting with new ones.", "openness", True),
    ("conscientiousness_1", "I plan my work and keep track of important details.", "conscientiousness", False),
    ("conscientiousness_2", "I follow through on commitments, even when work becomes difficult.", "conscientiousness", False),
    ("conscientiousness_3", "I often leave tasks unfinished until the last minute.", "conscientiousness", True),
    ("extraversion_1", "I feel energized by discussing ideas with a group.", "extraversion", False),
    ("extraversion_2", "I am comfortable speaking up when a team needs input.", "extraversion", False),
    ("agreeableness_1", "I try to understand a teammate's point of view before disagreeing.", "agreeableness", False),
    ("agreeableness_2", "I am willing to compromise when it helps the team succeed.", "agreeableness", False),
    ("neuroticism_1", "I stay composed when a project encounters unexpected problems.", "neuroticism", True),
    ("neuroticism_2", "Small setbacks make it hard for me to focus on the next step.", "neuroticism", False),
]


class PersonalityQuestionOut(BaseModel):
    id: str
    question: str


class PersonalityAnswerIn(BaseModel):
    question_id: str
    response: int = Field(..., ge=1, le=5)


class PersonalitySubmitIn(BaseModel):
    answers: list[PersonalityAnswerIn] = Field(..., min_length=12, max_length=12)


def _profile_or_404(user: User, db: Session) -> Profile:
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Create a profile before taking the personality assessment.")
    return profile


def _evaluate(answers: dict[str, int]) -> dict[str, object]:
    totals: dict[str, list[int]] = {}
    for question_id, _, dimension, reverse in QUESTIONS:
        response = answers[question_id]
        totals.setdefault(dimension, []).append(6 - response if reverse else response)

    scores = {dimension: round(((sum(values) / len(values)) - 1) / 4 * 100) for dimension, values in totals.items()}
    strongest = sorted(scores, key=scores.get, reverse=True)[:2]
    labels = {"openness": "Open-minded", "conscientiousness": "Dependable", "extraversion": "Engaging", "agreeableness": "Supportive", "neuroticism": "Resilient"}
    work_style = "Structured explorer" if scores["conscientiousness"] >= 60 and scores["openness"] >= 60 else "Adaptable contributor"
    communication_style = "Collaborative and expressive" if scores["extraversion"] >= 60 else "Thoughtful and focused"
    preferred_role = "Team facilitator" if scores["extraversion"] >= 60 and scores["agreeableness"] >= 60 else "Reliable contributor"
    return {
        "scores": scores,
        "work_style": work_style,
        "communication_style": communication_style,
        "preferred_role": preferred_role,
        "strengths": [labels[dimension] for dimension in strongest],
        "collaboration_notes": f"Your strongest indicators are {labels[strongest[0]].lower()} and {labels[strongest[1]].lower()}. Use these alongside your collaboration assessment to improve team recommendations.",
    }


@router.get("/start")
def start_assessment(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    _profile_or_404(current_user, db)
    return {"total_questions": len(QUESTIONS), "questions": [PersonalityQuestionOut(id=q[0], question=q[1]) for q in QUESTIONS]}


@router.post("/submit", response_model=PersonalitySubmitOut)
def submit_assessment(payload: PersonalitySubmitIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> PersonalitySubmitOut:
    profile = _profile_or_404(current_user, db)
    answer_map = {answer.question_id: answer.response for answer in payload.answers}
    expected_ids = {question[0] for question in QUESTIONS}
    if len(answer_map) != len(QUESTIONS) or set(answer_map) != expected_ids:
        raise HTTPException(status_code=400, detail="Answer each personality question exactly once.")

    evaluation = _evaluate(answer_map)
    personality = db.query(Personality).filter(Personality.profile_id == profile.id).first()
    if not personality:
        personality = Personality(profile_id=profile.id)
        db.add(personality)
    personality.raw_responses = json.dumps(answer_map)
    personality.openness_score = evaluation["scores"]["openness"]
    personality.conscientiousness_score = evaluation["scores"]["conscientiousness"]
    personality.extraversion_score = evaluation["scores"]["extraversion"]
    personality.agreeableness_score = evaluation["scores"]["agreeableness"]
    personality.neuroticism_score = evaluation["scores"]["neuroticism"]
    personality.work_style = evaluation["work_style"]
    personality.communication_style = evaluation["communication_style"]
    personality.preferred_role = evaluation["preferred_role"]
    personality.strengths = json.dumps(evaluation["strengths"])
    personality.collaboration_notes = evaluation["collaboration_notes"]
    personality.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(personality)
    return {"result": personality, "strengths": evaluation["strengths"]}


@router.get("/result", response_model=PersonalityOut)
def get_result(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> PersonalityOut:
    profile = _profile_or_404(current_user, db)
    personality = db.query(Personality).filter(Personality.profile_id == profile.id).first()
    if not personality or not personality.completed_at:
        raise HTTPException(status_code=404, detail="No completed personality assessment found.")
    return personality


@router.get("/status")
def get_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    profile = _profile_or_404(current_user, db)
    personality = db.query(Personality).filter(Personality.profile_id == profile.id).first()
    return {"completed": bool(personality and personality.completed_at), "completed_at": personality.completed_at if personality else None}
