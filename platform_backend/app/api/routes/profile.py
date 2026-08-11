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
from app.services.candidate_profile import (
    update_evidence_from_verification,
    update_availability_from_profile,
    update_experience_from_profile,
    update_role_from_profile,
)

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


def _get_or_create_profile(user_id: uuid.UUID, db: Session) -> Profile:
    """Return the user's profile, creating a bare one if it doesn't exist yet."""
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if profile:
        return profile
    profile = Profile(user_id=user_id, name="Developer")
    db.add(profile)
    db.flush()
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


def _availability_sync_data(avail_data) -> dict | None:
    """JSON-ready availability dict for the candidate profile sync, or None."""
    if avail_data is None:
        return None
    data = avail_data.model_dump(exclude_none=True, mode="json")
    return data if data else None


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
    if not profile_data.get("name"):
        profile_data["name"] = current_user.full_name or "Developer"
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

    # Sync availability + experience level into the candidate profile.
    avail_sync = _availability_sync_data(payload.availability)
    if avail_sync:
        update_availability_from_profile(db, current_user.id, avail_sync)
    update_experience_from_profile(
        db,
        current_user.id,
        profile.experience_level.value if profile.experience_level else None,
    )
    update_role_from_profile(db, current_user.id, profile.role)

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

    # Sync availability + experience level into the candidate profile.
    avail_sync = _availability_sync_data(payload.availability)
    if avail_sync:
        update_availability_from_profile(db, current_user.id, avail_sync)
    update_experience_from_profile(
        db,
        current_user.id,
        profile.experience_level.value if profile.experience_level else None,
    )
    update_role_from_profile(db, current_user.id, profile.role)

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
                    # ── Autofill academic fields from the resume (first entry) ──
                    education = resume_info.get("education") or []
                    if education:
                        edu = education[0]
                        if edu.get("institution") and not profile.college:
                            profile.college = edu["institution"]
                        if edu.get("degree") and not profile.degree:
                            profile.degree = edu["degree"]
                        if edu.get("course") and not profile.course:
                            profile.course = edu["course"]

                    # Build map of existing skills in DB: lower_name -> Skill object
                    existing_skills_map = {
                        s.name.strip().lower(): s 
                        for s in db.query(Skill).filter(Skill.profile_id == profile.id).all()
                    }
                    processed_names: set[str] = set()
                    verified_evidence: dict[str, float] = {}

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

                            verified_evidence[clean_name] = conf_score

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

                # ── Sync verified skill confidence into the Candidate Profile ──
                # Mirrors the GitHub-verified confidence scores into
                # profile_data.evidence. The skills table updates above are kept.
                if verified_evidence:
                    update_evidence_from_verification(db, current_user.id, verified_evidence)
            else:
                _log.error(f"Resume engine returned {resp.status_code}: {resp.text[:300]}")
                resume.parse_status = "failed"
                db.commit()

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to call resume engine: {e}")
        
    db.refresh(resume)
    return resume


# ── Resume & GitHub verification status ──────────────────────
@router.get("/verification-status")
def get_verification_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Lightweight check used by the Developer Hub completion ring:
    has the user run the Resume & GitHub verification flow?
    """
    from app.models.resume_verification import ResumeVerification

    latest = (
        db.query(ResumeVerification)
        .filter(ResumeVerification.user_id == current_user.id)
        .order_by(ResumeVerification.verified_at.desc())
        .first()
    )
    return {
        "completed": latest is not None,
        "status": latest.status if latest else None,
        "completed_at": latest.verified_at.isoformat() if latest else None,
        "matched_count": latest.matched_count if latest else 0,
        "verification_percentage": (
            float(latest.verification_percentage) if latest and latest.verification_percentage is not None else 0
        ),
    }


# ── Avatar ────────────────────────────────────────────────────
_ALLOWED_AVATAR_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _avatar_file_path(profile: Profile) -> Path | None:
    """Resolve the on-disk path of a profile's avatar from its avatar_url."""
    if not profile.avatar_url:
        return None
    name = Path(profile.avatar_url).name
    avatar_dir = Path(settings.avatar_dir)
    candidate = avatar_dir / name
    return candidate if candidate.exists() else None


@router.post("/avatar", response_model=ProfileOut)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload (or replace) the authenticated user's profile picture."""
    if file.content_type not in _ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PNG, JPEG, WebP or GIF images are accepted",
        )

    contents = await file.read()
    max_bytes = settings.max_avatar_size_mb * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds maximum allowed size of {settings.max_avatar_size_mb} MB",
        )
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    profile = _get_or_create_profile(current_user.id, db)

    ext = _ALLOWED_AVATAR_TYPES[file.content_type]
    avatar_dir = Path(settings.avatar_dir)
    avatar_dir.mkdir(parents=True, exist_ok=True)
    unique_name = f"{current_user.id}_{uuid.uuid4().hex}{ext}"
    file_path = avatar_dir / unique_name

    with open(file_path, "wb") as f:
        f.write(contents)

    # Replace an existing avatar (delete the old file on disk)
    old_path = _avatar_file_path(profile)
    if old_path and old_path != file_path:
        try:
            old_path.unlink(missing_ok=True)
        except OSError:
            pass

    profile.avatar_url = f"/uploads/avatars/{unique_name}"
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/avatar", response_model=ProfileOut)
def remove_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove the authenticated user's profile picture."""
    profile = _get_profile_or_404(current_user.id, db)

    old_path = _avatar_file_path(profile)
    if old_path:
        try:
            old_path.unlink(missing_ok=True)
        except OSError:
            pass

    profile.avatar_url = None
    db.commit()
    db.refresh(profile)
    return profile


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
