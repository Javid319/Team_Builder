"""add_collaboration_assessment

Revision ID: a1b2c3d4e5f6
Revises: d60d4ca3a45e
Create Date: 2026-08-08

Creates three tables for the Collaboration Assessment module:
  collaboration_questions   — question bank (seeded separately)
  collaboration_assessments — one row per attempt per user
  collaboration_answers     — one row per question per attempt
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a1b2c3d4e5f6"
down_revision = "d60d4ca3a45e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── enums — safe even if they already exist ────────────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE collaborationdimension AS ENUM (
                'LEADERSHIP', 'COMMUNICATION', 'COLLABORATION',
                'RELIABILITY', 'ADAPTABILITY', 'INITIATIVE'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE collaborationstatus AS ENUM ('STARTED', 'COMPLETED');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # ── collaboration_questions ────────────────────────────────
    # Use raw SQL to avoid SQLAlchemy auto-emitting CREATE TYPE again.
    op.execute("""
        CREATE TABLE IF NOT EXISTS collaboration_questions (
            id          UUID PRIMARY KEY,
            question    VARCHAR(500)            NOT NULL,
            dimension   collaborationdimension  NOT NULL,
            active      BOOLEAN                 NOT NULL DEFAULT TRUE,
            created_at  TIMESTAMPTZ             NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ             NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_collaboration_questions_id
            ON collaboration_questions (id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_collaboration_questions_dimension
            ON collaboration_questions (dimension)
    """)

    # ── collaboration_assessments ──────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS collaboration_assessments (
            id           UUID PRIMARY KEY,
            profile_id   UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            status       collaborationstatus NOT NULL DEFAULT 'STARTED',
            started_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
            completed_at TIMESTAMPTZ
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_collaboration_assessments_id
            ON collaboration_assessments (id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_collaboration_assessments_profile_id
            ON collaboration_assessments (profile_id)
    """)

    # ── collaboration_answers ──────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS collaboration_answers (
            id            UUID PRIMARY KEY,
            assessment_id UUID         NOT NULL
                REFERENCES collaboration_assessments(id) ON DELETE CASCADE,
            question_id   UUID         NOT NULL
                REFERENCES collaboration_questions(id)   ON DELETE CASCADE,
            response      SMALLINT     NOT NULL,
            answered_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_collaboration_answers_id
            ON collaboration_answers (id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_collaboration_answers_assessment_id
            ON collaboration_answers (assessment_id)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS collaboration_answers")
    op.execute("DROP TABLE IF EXISTS collaboration_assessments")
    op.execute("DROP TABLE IF EXISTS collaboration_questions")
    op.execute("DROP TYPE IF EXISTS collaborationstatus")
    op.execute("DROP TYPE IF EXISTS collaborationdimension")
