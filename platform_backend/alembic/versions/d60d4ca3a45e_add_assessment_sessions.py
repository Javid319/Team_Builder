"""add_assessment_sessions

Revision ID: d60d4ca3a45e
Revises: 8c0051de8553
Create Date: 2026-08-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d60d4ca3a45e"
down_revision = "8c0051de8553"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assessment_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("experience_level", sa.String(50), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "submitted", "completed", "failed", name="assessmentstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("questions_json", sa.Text(), nullable=True),
        sa.Column("answers_json",   sa.Text(), nullable=True),
        sa.Column("result_json",    sa.Text(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("submitted_at",  sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at",  sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_assessment_sessions_id",      "assessment_sessions", ["id"])
    op.create_index("ix_assessment_sessions_user_id", "assessment_sessions", ["user_id"])


def downgrade() -> None:
    op.drop_table("assessment_sessions")
    op.execute("DROP TYPE IF EXISTS assessmentstatus")
