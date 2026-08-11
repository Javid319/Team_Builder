"""Add role to profiles.

Revision ID: c1c2c3c4c5c6
Revises: b0b1b2b3b4c0
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c1c2c3c4c5c6"
down_revision: Union[str, None] = "b0b1b2b3b4c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("role", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "role")
