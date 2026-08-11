"""
Skill Assessment routes.

POST /assessment/start     — generate 10 questions via Groq, create session
POST /assessment/submit    — save answers, evaluate with Groq, write skills to DB
GET  /assessment/results   — return latest completed session results
GET  /assessment/sessions  — list all assessment sessions for the user
"""
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.profile import Profile
from app.models.skill import Skill, SkillEvidence, SkillSource, ConfidenceLevel
from app.models.assessment import AssessmentSession, AssessmentStatus
from app.schemas.assessment import (
    AssessmentStartOut,
    AssessmentSubmitIn,
    AssessmentResultOut,
    AssessmentSessionOut,
    QuestionOut,
    SkillResult,
)
from app.services.skill_confidence.groq_client import generate_questions, evaluate_answers

router = APIRouter(prefix="/assessment", tags=["Skill Assessment"])


# ── helpers ────────────────────────────────────────────────────

def _get_profile_or_404(user_id: uuid.UUID, db: Session) -> Profile:
    p = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Create a profile first before starting an assessment",
        )
    return p


def _confidence_level(score: float) -> ConfidenceLevel:
    if score >= 71:
        return ConfidenceLevel.high
    if score >= 41:
        return ConfidenceLevel.medium
    return ConfidenceLevel.low


# ── Start ──────────────────────────────────────────────────────

@router.post("/start", response_model=AssessmentStartOut, status_code=status.HTTP_201_CREATED)
def start_assessment(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate 10 questions via Groq based on intermediate experience level.
    Requires authentication.
    """
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    exp_level = profile.experience_level.value if (profile and profile.experience_level) else "intermediate"
    user_skills = [s.name for s in profile.skills] if profile else []

    try:
        questions = generate_questions(exp_level, user_skills)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate questions: {str(e)}",
        )

    session = AssessmentSession(
        user_id=current_user.id,
        experience_level=exp_level,
        status=AssessmentStatus.pending,
        questions_json=json.dumps(questions),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Strip correct_answer + explanation before sending to frontend
    safe_questions = [
        QuestionOut(**{k: v for k, v in q.items() if k not in ("correct_answer", "explanation")})
        for q in questions
    ]

    return AssessmentStartOut(
        session_id=session.id,
        experience_level=exp_level,
        questions=safe_questions,
        total_questions=len(safe_questions),
    )


# ── Submit ─────────────────────────────────────────────────────

@router.post("/submit", response_model=AssessmentResultOut)
def submit_assessment(
    payload: AssessmentSubmitIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit answers — authentication required."""
    session = db.query(AssessmentSession).filter(
        AssessmentSession.id == payload.session_id,
        AssessmentSession.user_id == current_user.id,
    ).first()

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Allow resubmitting if previous attempt failed
    curr_status = str(session.status.value if hasattr(session.status, "value") else session.status).lower()
    if curr_status == "failed":
        session.status = AssessmentStatus.pending
        db.commit()
        db.refresh(session)
        curr_status = "pending"

    if curr_status not in ("pending", "submitted"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Session is already {curr_status}",
        )

    answers = [a.model_dump() for a in payload.answers]
    questions = json.loads(session.questions_json)

    # Save answers
    session.answers_json   = json.dumps(answers)
    session.submitted_at   = datetime.now(timezone.utc)
    session.status         = AssessmentStatus.submitted
    db.commit()

    # Evaluate with Groq
    try:
        skill_results = evaluate_answers(session.experience_level, questions, answers)
    except Exception as e:
        session.status = AssessmentStatus.failed
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Groq evaluation failed: {str(e)}",
        )

    # Note: Not saving skills to profile since this is anonymous assessment
    # Skills are stored in session.result_json for display purposes only

    # Finalise session
    session.result_json   = json.dumps(skill_results)
    session.status        = AssessmentStatus.completed
    session.completed_at  = datetime.now(timezone.utc)
    db.commit()
    db.refresh(session)

    return AssessmentResultOut(
        session_id=session.id,
        status=session.status,
        experience_level=session.experience_level,
        skills=[SkillResult(**s) for s in skill_results],
        completed_at=session.completed_at,
    )


# ── Results ────────────────────────────────────────────────────

@router.get("/results", response_model=AssessmentResultOut)
def get_latest_results(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the most recent completed assessment for the user."""
    session = (
        db.query(AssessmentSession)
        .filter(
            AssessmentSession.user_id == current_user.id,
            AssessmentSession.status  == AssessmentStatus.completed,
        )
        .order_by(AssessmentSession.completed_at.desc())
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No completed assessment found",
        )

    skills = [SkillResult(**s) for s in json.loads(session.result_json or "[]")]

    return AssessmentResultOut(
        session_id=session.id,
        status=session.status,
        experience_level=session.experience_level,
        skills=skills,
        completed_at=session.completed_at,
    )


# ── Sessions list ──────────────────────────────────────────────

@router.get("/sessions", response_model=list[AssessmentSessionOut])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all assessment sessions for the current user."""
    return (
        db.query(AssessmentSession)
        .filter(AssessmentSession.user_id == current_user.id)
        .order_by(AssessmentSession.started_at.desc())
        .all()
    )
