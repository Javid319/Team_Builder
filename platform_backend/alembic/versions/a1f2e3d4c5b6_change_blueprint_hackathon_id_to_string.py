"""Change blueprints.hackathon_id from UUID to VARCHAR(255)

Hackathon IDs are string-based in the mock service (e.g. "hack_001"),
not UUIDs. Changing the column to VARCHAR so both formats are accepted.

Revision ID: a1f2e3d4c5b6
Revises: cfcb3149fc67
Create Date: 2026-08-12 23:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a1f2e3d4c5b6'
down_revision: Union[str, None] = 'cfcb3149fc67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the existing UUID-typed column index first, then alter type
    op.drop_index('ix_blueprints_hackathon_id', table_name='blueprints')
    op.alter_column(
        'blueprints',
        'hackathon_id',
        type_=sa.String(255),
        postgresql_using='hackathon_id::text',
        existing_nullable=False,
    )
    op.create_index('ix_blueprints_hackathon_id', 'blueprints', ['hackathon_id'], unique=False)


def downgrade() -> None:
    from sqlalchemy.dialects import postgresql
    op.drop_index('ix_blueprints_hackathon_id', table_name='blueprints')
    op.alter_column(
        'blueprints',
        'hackathon_id',
        type_=postgresql.UUID(as_uuid=True),
        postgresql_using='hackathon_id::uuid',
        existing_nullable=False,
    )
    op.create_index('ix_blueprints_hackathon_id', 'blueprints', ['hackathon_id'], unique=False)
