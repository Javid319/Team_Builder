"""initial_schema

Revision ID: 8c0051de8553
Revises:
Create Date: 2026-08-07

Creates all tables for the Hackathon Team Formation Platform:
  users, profiles, availability, skills, skill_evidence,
  personality, projects, resumes
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "8c0051de8553"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"])

    # ── profiles ──────────────────────────────────────────────
    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("college", sa.String(255), nullable=True),
        sa.Column("degree", sa.String(255), nullable=True),
        sa.Column("year_of_study", sa.Integer(), nullable=True),
        sa.Column("github_url", sa.String(500), nullable=True),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("leetcode_url", sa.String(500), nullable=True),
        sa.Column(
            "experience_level",
            sa.Enum("beginner", "intermediate", "experienced", name="experiencelevel"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_profiles_id", "profiles", ["id"])

    # ── availability ──────────────────────────────────────────
    op.create_table(
        "availability",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("working_days", postgresql.ARRAY(sa.String(10)), nullable=True),
        sa.Column("working_hours", sa.String(50), nullable=True),
        sa.Column("timezone", sa.String(100), nullable=True),
        sa.Column(
            "commitment_level",
            sa.Enum("casual", "part_time", "full_time", name="commitmentlevel"),
            nullable=True,
        ),
    )
    op.create_index("ix_availability_id", "availability", ["id"])

    # ── projects ──────────────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("technologies", sa.Text(), nullable=True),
        sa.Column("github_repo_url", sa.String(500), nullable=True),
        sa.Column(
            "source",
            sa.Enum("resume", "github", "manual", name="projectsource"),
            nullable=False,
            server_default="manual",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_projects_id", "projects", ["id"])

    # ── skills ────────────────────────────────────────────────
    op.create_table(
        "skills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column(
            "source",
            sa.Enum("resume", "github", "assessment", "manual", name="skillsource"),
            nullable=False,
            server_default="manual",
        ),
        sa.Column("confidence_score", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "confidence_level",
            sa.Enum("low", "medium", "high", name="confidencelevel"),
            nullable=True,
        ),
    )
    op.create_index("ix_skills_id", "skills", ["id"])

    # ── skill_evidence ────────────────────────────────────────
    op.create_table(
        "skill_evidence",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "skill_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("skills.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_type",
            sa.Enum("resume", "github", "assessment", "manual", name="skillsource"),
            nullable=False,
        ),
        sa.Column("source_url", sa.String(1000), nullable=True),
        sa.Column("evidence_text", sa.Text(), nullable=True),
        sa.Column("weight", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_skill_evidence_id", "skill_evidence", ["id"])

    # ── personality ───────────────────────────────────────────
    op.create_table(
        "personality",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("raw_responses", sa.Text(), nullable=True),
        sa.Column("openness_score", sa.SmallInteger(), nullable=True),
        sa.Column("conscientiousness_score", sa.SmallInteger(), nullable=True),
        sa.Column("extraversion_score", sa.SmallInteger(), nullable=True),
        sa.Column("agreeableness_score", sa.SmallInteger(), nullable=True),
        sa.Column("neuroticism_score", sa.SmallInteger(), nullable=True),
        sa.Column("work_style", sa.String(100), nullable=True),
        sa.Column("communication_style", sa.String(100), nullable=True),
        sa.Column("preferred_role", sa.String(100), nullable=True),
        sa.Column("strengths", sa.Text(), nullable=True),
        sa.Column("collaboration_notes", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_personality_id", "personality", ["id"])

    # ── resumes ───────────────────────────────────────────────
    op.create_table(
        "resumes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("original_filename", sa.String(500), nullable=False),
        sa.Column("file_path", sa.String(1000), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("parsed_text", sa.Text(), nullable=True),
        sa.Column("parse_status", sa.String(50), nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_resumes_id", "resumes", ["id"])
    op.create_index("ix_resumes_user_id", "resumes", ["user_id"])


def downgrade() -> None:
    op.drop_table("resumes")
    op.drop_table("personality")
    op.drop_table("skill_evidence")
    op.drop_table("skills")
    op.drop_table("projects")
    op.drop_table("availability")
    op.drop_table("profiles")
    op.drop_table("users")

    # Drop custom enum types
    op.execute("DROP TYPE IF EXISTS skillsource")
    op.execute("DROP TYPE IF EXISTS confidencelevel")
    op.execute("DROP TYPE IF EXISTS projectsource")
    op.execute("DROP TYPE IF EXISTS experiencelevel")
    op.execute("DROP TYPE IF EXISTS commitmentlevel")
