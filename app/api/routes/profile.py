import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.profile import Profile
from app.models.availability import Availability
from app.models.resume import Resume
from app.models.skill import Skill, SkillSource, ConfidenceLevel
from app.schemas.profile import ProfileCreate, ProfileUpdate, ProfileOut
from app.schemas.resume import ResumeOut
from app.schemas.skill import SkillCreate, SkillOut

router = APIRouter(prefix="/profile", tags=["Profile"])


# ── helpers ───────────────────────────────────────────────────
def _get_profile_or_404(user_id: uuid.UUID, db: Session) -> Profile:
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found. Please create one first.",
        )
    return profile


def _upsert_availability(profile: Profile, avail_data, db: Session) -> None:
    """Create or update the availability record linked to this profile."""
    if avail_data is None:
        return

    data = avail_data.model_dump(exclude_none=True)
    if profile.availability:
        for k, v in data.items():
            setattr(profile.availability, k, v)
    else:
        profile.availability = Availability(profile_id=profile.id, **data)


# ── Create Profile ────────────────────────────────────────────
@router.post("/", response_model=ProfileOut, status_code=status.HTTP_201_CREATED)
def create_profile(
    payload: ProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a basic profile for the authenticated user."""

    existing = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile already exists. Use PATCH /profile to update it.",
        )

    profile_data = payload.model_dump(exclude={"availability"})
    profile = Profile(user_id=current_user.id, **profile_data)
    db.add(profile)
    db.flush()  # get profile.id before inserting availability

    if payload.availability:
        avail = Availability(
            profile_id=profile.id,
            **payload.availability.model_dump(exclude_none=True),
        )
        db.add(avail)

    db.commit()
    db.refresh(profile)
    return profile


# ── Update Profile ────────────────────────────────────────────
@router.patch("/", response_model=ProfileOut)
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update any field on the authenticated user's profile."""
    profile = _get_profile_or_404(current_user.id, db)

    update_data = payload.model_dump(exclude={"availability"}, exclude_none=True)
    for k, v in update_data.items():
        setattr(profile, k, v)

    _upsert_availability(profile, payload.availability, db)

    db.commit()
    db.refresh(profile)
    return profile


# ── Upload Resume ─────────────────────────────────────────────
@router.post("/resume", response_model=ResumeOut, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept a PDF resume, store it on disk, and create a Resume row.
    Marks all previous resumes for this user as not current.
    """
    # Validate file type
    if file.content_type not in ("application/pdf",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are accepted",
        )

    # Validate file size
    contents = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.max_upload_size_mb} MB",
        )

    # Build unique filename: <user_id>_<uuid>.pdf
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    unique_name = f"{current_user.id}_{uuid.uuid4().hex}.pdf"
    file_path = upload_dir / unique_name

    with open(file_path, "wb") as f:
        f.write(contents)

    # Mark existing resumes as not current
    db.query(Resume).filter(
        Resume.user_id == current_user.id,
        Resume.is_current == True,  # noqa: E712
    ).update({"is_current": False})

    resume = Resume(
        user_id=current_user.id,
        original_filename=file.filename,
        file_path=str(file_path),
        content_type=file.content_type,
        is_current=True,
        parse_status="pending",
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


# ── Get Profile ───────────────────────────────────────────────
@router.get("/", response_model=ProfileOut)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the full profile of the authenticated user."""
    return _get_profile_or_404(current_user.id, db)


# ── Get Profile by User ID (for AI modules / admin use) ───────
@router.get("/{user_id}", response_model=ProfileOut)
def get_profile_by_id(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),    # must be authenticated
):
    """Return a specific user's profile by user_id. Used by AI modules."""
    return _get_profile_or_404(user_id, db)


# ── Skills ────────────────────────────────────────────────────

@router.post("/skills", response_model=SkillOut, status_code=status.HTTP_201_CREATED)
def add_skill(
    payload: SkillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually add a skill to the user's profile."""
    profile = _get_profile_or_404(current_user.id, db)

    skill = Skill(
        profile_id=profile.id,
        name=payload.name,
        category=payload.category,
        source=SkillSource.manual,
        confidence_score=payload.confidence_score,
        confidence_level=ConfidenceLevel(payload.confidence_level)
            if payload.confidence_level else None,
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


@router.get("/skills", response_model=list[SkillOut])
def get_skills(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all skills for the authenticated user."""
    profile = _get_profile_or_404(current_user.id, db)
    return profile.skills


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_skill(
    skill_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a skill by ID."""
    profile = _get_profile_or_404(current_user.id, db)
    skill = db.query(Skill).filter(
        Skill.id == skill_id,
        Skill.profile_id == profile.id,
    ).first()

    if not skill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Skill not found")

    db.delete(skill)
    db.commit()
