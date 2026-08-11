"""add_candidate_profiles

Revision ID: b0b1b2b3b4c0
Revises: f6a7b8c9d0e1
"""
from alembic import op

revision = "b0b1b2b3b4c0"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS candidate_profiles (
            id               UUID        PRIMARY KEY,
            user_id          UUID        NOT NULL UNIQUE
                REFERENCES users(id) ON DELETE CASCADE,
            profile_data     JSONB       NOT NULL,
            profile_strength INTEGER     NOT NULL DEFAULT 0,
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_candidate_profiles_id
            ON candidate_profiles (id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_candidate_profiles_user_id
            ON candidate_profiles (user_id)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS candidate_profiles")
