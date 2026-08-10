import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
import httpx
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
    github_username: str | None = Form(default=None),
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
    
    # ── Call Resume Engine ──
    try:
        from app.models.resume_verification import ResumeVerification
        import logging as _logging
        _log = _logging.getLogger(__name__)

        async with httpx.AsyncClient() as client:
            form_data = {"github_username": github_username} if github_username else {}
            files = {"file": (file.filename, contents, file.content_type)}
            resp = await client.post("http://localhost:8001/parse", data=form_data, files=files, timeout=90.0)

            if resp.status_code == 200:
                data = resp.json()
                resume.parse_status = "completed"

                github_info = data.get("github_verification", {})
                resume_info = data.get("resume_profile", {})
                stats = github_info.get("statistics", {})

                # ── Save ResumeVerification record ──
                verification_record = ResumeVerification(
                    resume_id=resume.id,
                    user_id=current_user.id,
                    status=github_info.get("status", "skipped"),
                    github_username=github_info.get("username"),
                    skip_reason=github_info.get("reason"),
                    resume_skills_count=stats.get("resume_skills_count"),
                    matched_count=stats.get("matched_count"),
                    unmatched_count=stats.get("unmatched_count"),
                    verification_percentage=stats.get("verification_percentage"),
                    matched_skills=github_info.get("matched_skills"),
                    unmatched_skills=github_info.get("unmatched_skills"),
                    raw_response=data,
                )
                db.add(verification_record)

                profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
                if profile:
                    # Build map of existing skills in DB: lower_name -> Skill object
                    existing_skills_map = {
                        s.name.strip().lower(): s 
                        for s in db.query(Skill).filter(Skill.profile_id == profile.id).all()
                    }
                    processed_names: set[str] = set()

                    # 1. GitHub-verified Skills (High Confidence)
                    if github_info.get("status") == "completed":
                        for match in github_info.get("matched_skills", []):
                            raw_name = match.get("github_skill") or match.get("resume_skill") or match.get("skill")
                            if not raw_name or not isinstance(raw_name, str) or not raw_name.strip():
                                continue
                            
                            clean_name = raw_name.strip()
                            norm_name = clean_name.lower()
                            if norm_name in processed_names:
                                continue
                            processed_names.add(norm_name)

                            confidence_data = match.get("confidence", {})
                            conf_score = float(confidence_data.get("score", 90))
                            conf_level = (
                                ConfidenceLevel.advanced if conf_score >= 60
                                else ConfidenceLevel.intermediate if conf_score >= 30
                                else ConfidenceLevel.beginner
                            )

                            if norm_name in existing_skills_map:
                                existing_skill = existing_skills_map[norm_name]
                                existing_skill.source = SkillSource.github
                                existing_skill.confidence_score = conf_score
                                existing_skill.confidence_level = conf_level
                            else:
                                new_skill = Skill(
                                    profile_id=profile.id,
                                    name=clean_name,
                                    source=SkillSource.github,
                                    confidence_score=conf_score,
                                    confidence_level=conf_level,
                                )
                                db.add(new_skill)
                                existing_skills_map[norm_name] = new_skill

                    # 2. Resume-only Skills (Medium Confidence)
                    for raw_name in resume_info.get("technical_skills", []):
                        if not raw_name or not isinstance(raw_name, str) or not raw_name.strip():
                            continue
                        
                        clean_name = raw_name.strip()
                        norm_name = clean_name.lower()
                        if norm_name in processed_names:
                            continue
                        processed_names.add(norm_name)

                        if norm_name in existing_skills_map:
                            continue

                        new_skill = Skill(
                            profile_id=profile.id,
                            name=clean_name,
                            source=SkillSource.resume,
                            confidence_score=60.0,
                            confidence_level=ConfidenceLevel.intermediate,
                        )
                        db.add(new_skill)
                        existing_skills_map[norm_name] = new_skill

                db.commit()
            else:
                _log.error(f"Resume engine returned {resp.status_code}: {resp.text[:300]}")
                resume.parse_status = "failed"
                db.commit()

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to call resume engine: {e}")
        
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


# ── Skills ────────────────────────────────────────────────────

@router.post("/skills", response_model=SkillOut, status_code=status.HTTP_201_CREATED)
def add_skill(
    payload: SkillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually add a skill to the user's profile. Returns existing skill if duplicate."""
    profile = _get_profile_or_404(current_user.id, db)
    clean_name = payload.name.strip()

    # Check for existing duplicate (case-insensitive)
    existing = db.query(Skill).filter(
        Skill.profile_id == profile.id,
        Skill.name.ilike(clean_name)
    ).first()

    if existing:
        return existing

    skill = Skill(
        profile_id=profile.id,
        name=clean_name,
        source=SkillSource.manual,
        confidence_level=payload.level,
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
    """Return all skills for the authenticated user, auto-cleaning historical duplicates."""
    profile = _get_profile_or_404(current_user.id, db)
    skills = db.query(Skill).filter(Skill.profile_id == profile.id).all()

    seen = {}
    duplicates_to_delete = []

    for s in skills:
        norm = s.name.strip().lower()
        if norm in seen:
            duplicates_to_delete.append(s)
        else:
            seen[norm] = s

    if duplicates_to_delete:
        for dup in duplicates_to_delete:
            db.delete(dup)
        db.commit()
        skills = list(seen.values())

    return skills


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


# ── Get Profile by User ID (for AI modules / admin use) ───────
# NOTE: this must come AFTER all /profile/skills routes to avoid
# FastAPI treating "skills" as a user_id UUID parameter
@router.get("/{user_id}", response_model=ProfileOut)
def get_profile_by_id(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return a specific user's profile by user_id. Used by AI modules."""
    return _get_profile_or_404(user_id, db)
