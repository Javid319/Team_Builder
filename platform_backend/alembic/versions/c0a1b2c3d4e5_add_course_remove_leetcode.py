"""Add course to profiles, drop leetcode_url.

Revision ID: c0a1b2c3d4e5
Revises: 9b1c2d3e4f5a
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c0a1b2c3d4e5"
down_revision: Union[str, None] = "9b1c2d3e4f5a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("course", sa.String(length=255), nullable=True))
    op.drop_column("profiles", "leetcode_url")


def downgrade() -> None:
    op.add_column("profiles", sa.Column("leetcode_url", sa.String(length=500), nullable=True))
    op.drop_column("profiles", "course")
