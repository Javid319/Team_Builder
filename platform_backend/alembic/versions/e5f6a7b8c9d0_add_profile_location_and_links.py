"""Add department, state, city and leetcode_url to profiles.

Revision ID: e5f6a7b8c9d0
Revises: c0a1b2c3d4e5
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "c0a1b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("department", sa.String(length=255), nullable=True))
    op.add_column("profiles", sa.Column("state", sa.String(length=255), nullable=True))
    op.add_column("profiles", sa.Column("city", sa.String(length=255), nullable=True))
    op.add_column("profiles", sa.Column("leetcode_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "leetcode_url")
    op.drop_column("profiles", "city")
    op.drop_column("profiles", "state")
    op.drop_column("profiles", "department")
