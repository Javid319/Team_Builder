"""team formation tables

Revision ID: d2e3f4a5b6c7
Revises: c1c2c3c4c5c6
Create Date: 2026-08-12

Creates the database foundation for the team formation system:
  teams, team_members, team_invitations, team_join_requests

Enforces (DB-level) that a user may belong to only one active team,
where an active team is one with status OPEN or FULL.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "d2e3f4a5b6c7"
down_revision = "c1c2c3c4c5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    teamstatus = postgresql.ENUM(
        "OPEN", "FULL", "LOCKED", name="teamstatus"
    )
    teammemberrole = postgresql.ENUM("OWNER", "MEMBER", name="teammemberrole")
    invitationstatus = postgresql.ENUM(
        "PENDING", "ACCEPTED", "REJECTED", "CANCELLED", name="invitationstatus"
    )
    joinrequeststatus = postgresql.ENUM(
        "PENDING", "ACCEPTED", "REJECTED", name="joinrequeststatus"
    )

    # Enum types are created automatically when their tables are created.

    # ── teams ──────────────────────────────────────────────────
    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("max_members", sa.Integer(), nullable=False, server_default=sa.text("4")),
        sa.Column(
            "status",
            teamstatus,
            nullable=False,
            server_default=sa.text("'OPEN'"),
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
    op.create_index("ix_teams_id", "teams", ["id"])
    op.create_index("ix_teams_owner_id", "teams", ["owner_id"])

    # ── team_members ───────────────────────────────────────────
    op.create_table(
        "team_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role",
            teammemberrole,
            nullable=False,
            server_default=sa.text("'MEMBER'"),
        ),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("team_id", "user_id", name="uq_team_members_team_user"),
    )
    op.create_index("ix_team_members_id", "team_members", ["id"])
    op.create_index("ix_team_members_team_id", "team_members", ["team_id"])
    op.create_index("ix_team_members_user_id", "team_members", ["user_id"])

    # ── team_invitations ───────────────────────────────────────
    op.create_table(
        "team_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "receiver_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            invitationstatus,
            nullable=False,
            server_default=sa.text("'PENDING'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_team_invitations_id", "team_invitations", ["id"])
    op.create_index("ix_team_invitations_team_id", "team_invitations", ["team_id"])
    op.create_index("ix_team_invitations_sender_id", "team_invitations", ["sender_id"])
    op.create_index("ix_team_invitations_receiver_id", "team_invitations", ["receiver_id"])
    # Fast lookup of a user's open invites.
    op.create_index(
        "ix_team_invitations_receiver_status",
        "team_invitations",
        ["receiver_id", "status"],
    )

    # ── team_join_requests ─────────────────────────────────────
    op.create_table(
        "team_join_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            joinrequeststatus,
            nullable=False,
            server_default=sa.text("'PENDING'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_team_join_requests_id", "team_join_requests", ["id"])
    op.create_index("ix_team_join_requests_team_id", "team_join_requests", ["team_id"])
    op.create_index("ix_team_join_requests_user_id", "team_join_requests", ["user_id"])

    # ── Constraint: a user may belong to only one active team ──
    # Enforced at the DB level with a trigger. "Active" means the
    # membership's team currently has status OPEN or FULL; LOCKED teams
    # are historical and do not count against the limit.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION enforce_single_active_team()
        RETURNS trigger AS $func$
        DECLARE
            active_count integer;
        BEGIN
            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;

            SELECT COUNT(*) INTO active_count
            FROM team_members tm
            JOIN teams t ON t.id = tm.team_id
            WHERE tm.user_id = NEW.user_id
              AND tm.id IS DISTINCT FROM NEW.id
              AND t.status IN ('OPEN', 'FULL');

            IF active_count > 0 THEN
                RAISE EXCEPTION 'user already belongs to an active team'
                    USING ERRCODE = '23505', CONSTRAINT = 'one_active_team_per_user';
            END IF;

            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_team_members_single_active_team
        BEFORE INSERT OR UPDATE OF team_id, user_id ON team_members
        FOR EACH ROW EXECUTE FUNCTION enforce_single_active_team();
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP TRIGGER IF EXISTS trg_team_members_single_active_team ON team_members"
    )
    op.execute("DROP FUNCTION IF EXISTS enforce_single_active_team()")

    op.drop_table("team_join_requests")
    op.drop_table("team_invitations")
    op.drop_table("team_members")
    op.drop_table("teams")

    op.execute("DROP TYPE IF EXISTS teamstatus")
    op.execute("DROP TYPE IF EXISTS teammemberrole")
    op.execute("DROP TYPE IF EXISTS invitationstatus")
    op.execute("DROP TYPE IF EXISTS joinrequeststatus")
