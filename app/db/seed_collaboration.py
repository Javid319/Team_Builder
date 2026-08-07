"""
Collaboration Question Bank Seeder
===================================
Run once after the migration to populate the question bank:

    python -m app.db.seed_collaboration

36 questions — 6 per dimension — evenly distributed across:
  LEADERSHIP | COMMUNICATION | COLLABORATION |
  RELIABILITY | ADAPTABILITY | INITIATIVE
"""
import uuid
from datetime import datetime, timezone

from app.db.session import SessionLocal
from app.models.collaboration import CollaborationQuestion, CollaborationDimension

# ---------------------------------------------------------------------------
# Question bank — 6 questions × 6 dimensions = 36 total
# ---------------------------------------------------------------------------
QUESTIONS: list[dict] = [
    # ── LEADERSHIP (6) ──────────────────────────────────────────────────────
    {
        "question": "If nobody takes charge, I'm comfortable stepping up to coordinate the team.",
        "dimension": CollaborationDimension.LEADERSHIP,
    },
    {
        "question": "I enjoy organising tasks so that everyone on the team knows what to work on.",
        "dimension": CollaborationDimension.LEADERSHIP,
    },
    {
        "question": "I feel confident making decisions on behalf of the group when a situation is urgent.",
        "dimension": CollaborationDimension.LEADERSHIP,
    },
    {
        "question": "I proactively check in with teammates to make sure everyone is on track.",
        "dimension": CollaborationDimension.LEADERSHIP,
    },
    {
        "question": "When the team is stuck, I take initiative to propose a path forward.",
        "dimension": CollaborationDimension.LEADERSHIP,
    },
    {
        "question": "I am comfortable facilitating a discussion and keeping it focused on the goal.",
        "dimension": CollaborationDimension.LEADERSHIP,
    },

    # ── COMMUNICATION (6) ────────────────────────────────────────────────────
    {
        "question": "I regularly update teammates about my progress without being asked.",
        "dimension": CollaborationDimension.COMMUNICATION,
    },
    {
        "question": "I ask questions early instead of waiting until I am completely stuck.",
        "dimension": CollaborationDimension.COMMUNICATION,
    },
    {
        "question": "I clearly explain my ideas so that teammates with different backgrounds can follow.",
        "dimension": CollaborationDimension.COMMUNICATION,
    },
    {
        "question": "I listen carefully and make sure I understand what others are saying before responding.",
        "dimension": CollaborationDimension.COMMUNICATION,
    },
    {
        "question": "When there is a misunderstanding, I address it directly and calmly.",
        "dimension": CollaborationDimension.COMMUNICATION,
    },
    {
        "question": "I share blockers or risks with the team as soon as I become aware of them.",
        "dimension": CollaborationDimension.COMMUNICATION,
    },

    # ── COLLABORATION (6) ────────────────────────────────────────────────────
    {
        "question": "I enjoy solving problems together with teammates rather than working alone.",
        "dimension": CollaborationDimension.COLLABORATION,
    },
    {
        "question": "I actively seek feedback from teammates on my work.",
        "dimension": CollaborationDimension.COLLABORATION,
    },
    {
        "question": "I am willing to compromise my preferred approach if the team agrees on a different solution.",
        "dimension": CollaborationDimension.COLLABORATION,
    },
    {
        "question": "I make an effort to understand and incorporate teammates' ideas into shared work.",
        "dimension": CollaborationDimension.COLLABORATION,
    },
    {
        "question": "I help teammates when they are struggling, even if it is outside my assigned tasks.",
        "dimension": CollaborationDimension.COLLABORATION,
    },
    {
        "question": "I celebrate the team's achievements rather than focusing only on my own contributions.",
        "dimension": CollaborationDimension.COLLABORATION,
    },

    # ── RELIABILITY (6) ─────────────────────────────────────────────────────
    {
        "question": "If I accept a task, I make sure it gets completed.",
        "dimension": CollaborationDimension.RELIABILITY,
    },
    {
        "question": "I try to finish my assigned work before the agreed deadline.",
        "dimension": CollaborationDimension.RELIABILITY,
    },
    {
        "question": "I communicate in advance if I realise I will not be able to meet a commitment.",
        "dimension": CollaborationDimension.RELIABILITY,
    },
    {
        "question": "Teammates can count on me to show up to meetings and calls on time.",
        "dimension": CollaborationDimension.RELIABILITY,
    },
    {
        "question": "I follow through on every task I volunteer for, no matter how small.",
        "dimension": CollaborationDimension.RELIABILITY,
    },
    {
        "question": "I double-check my work before handing it off to avoid creating problems for others.",
        "dimension": CollaborationDimension.RELIABILITY,
    },

    # ── ADAPTABILITY (6) ─────────────────────────────────────────────────────
    {
        "question": "I am comfortable changing my approach when project requirements change.",
        "dimension": CollaborationDimension.ADAPTABILITY,
    },
    {
        "question": "I can quickly learn and use unfamiliar tools or technologies if the team needs them.",
        "dimension": CollaborationDimension.ADAPTABILITY,
    },
    {
        "question": "I stay calm and productive when unexpected problems arise during a project.",
        "dimension": CollaborationDimension.ADAPTABILITY,
    },
    {
        "question": "I adjust my communication style to suit different teammates and situations.",
        "dimension": CollaborationDimension.ADAPTABILITY,
    },
    {
        "question": "I view changing priorities as a normal part of teamwork rather than a disruption.",
        "dimension": CollaborationDimension.ADAPTABILITY,
    },
    {
        "question": "I am open to feedback that challenges my existing approach.",
        "dimension": CollaborationDimension.ADAPTABILITY,
    },

    # ── INITIATIVE (6) ──────────────────────────────────────────────────────
    {
        "question": "When I notice a problem, I try to solve it without waiting to be asked.",
        "dimension": CollaborationDimension.INITIATIVE,
    },
    {
        "question": "I enjoy suggesting improvements to the team's workflow or output.",
        "dimension": CollaborationDimension.INITIATIVE,
    },
    {
        "question": "I volunteer for tasks that are outside my comfort zone to help the team move forward.",
        "dimension": CollaborationDimension.INITIATIVE,
    },
    {
        "question": "I look for ways to add value beyond my defined responsibilities.",
        "dimension": CollaborationDimension.INITIATIVE,
    },
    {
        "question": "I do background research on my own to come better prepared to team discussions.",
        "dimension": CollaborationDimension.INITIATIVE,
    },
    {
        "question": "I raise new ideas or opportunities even when they are not directly requested.",
        "dimension": CollaborationDimension.INITIATIVE,
    },
]


# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------

def seed(clear_existing: bool = False) -> None:
    """Insert questions into the database.

    Args:
        clear_existing: If True, deletes all existing questions before seeding.
                        Use with caution — this also deletes all answers via CASCADE.
    """
    db = SessionLocal()
    try:
        existing_count = db.query(CollaborationQuestion).count()

        if existing_count > 0 and not clear_existing:
            print(
                f"[seed_collaboration] {existing_count} questions already exist. "
                "Skipping. Pass clear_existing=True to re-seed."
            )
            return

        if clear_existing and existing_count > 0:
            db.query(CollaborationQuestion).delete()
            db.commit()
            print(f"[seed_collaboration] Cleared {existing_count} existing questions.")

        now = datetime.now(timezone.utc)
        rows = [
            CollaborationQuestion(
                id=uuid.uuid4(),
                question=q["question"],
                dimension=q["dimension"],
                active=True,
                created_at=now,
                updated_at=now,
            )
            for q in QUESTIONS
        ]

        db.bulk_save_objects(rows)
        db.commit()
        print(f"[seed_collaboration] Seeded {len(rows)} questions successfully.")

        # Verify distribution
        for dim in CollaborationDimension:
            count = (
                db.query(CollaborationQuestion)
                .filter(
                    CollaborationQuestion.dimension == dim,
                    CollaborationQuestion.active == True,  # noqa: E712
                )
                .count()
            )
            print(f"  {dim.value:15s}: {count} questions")

    finally:
        db.close()


if __name__ == "__main__":
    import sys

    clear = "--clear" in sys.argv
    seed(clear_existing=clear)
