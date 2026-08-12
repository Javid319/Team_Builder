"""
Profile Strength Backfill
==========================
Recalculate profile_strength for every existing candidate_profiles row using
the shared calculate_profile_strength() logic. Safe to re-run anytime.

    python -m app.db.backfill_profile_strength
"""
import app.db.base  # noqa: F401 — registers all models with the SQLAlchemy mapper
from app.db.session import SessionLocal
from app.models.candidate_profile import CandidateProfile
from app.services.candidate_profile import calculate_profile_strength


def backfill() -> int:
    """Update profile_strength for all rows. Returns the number updated."""
    db = SessionLocal()
    try:
        rows = db.query(CandidateProfile).all()
        updated = 0
        for row in rows:
            new_strength = calculate_profile_strength(row.profile_data or {})
            if row.profile_strength != new_strength:
                row.profile_strength = new_strength
                updated += 1

        db.commit()
        print(
            f"[backfill_profile_strength] Recalculated {len(rows)} rows; "
            f"{updated} changed."
        )
        return updated
    finally:
        db.close()


if __name__ == "__main__":
    backfill()
