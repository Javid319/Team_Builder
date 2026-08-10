"""Persist assigned collaboration questions and result scores.

Revision ID: 9b1c2d3e4f5a
Revises: 73f9581be055
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "9b1c2d3e4f5a"
down_revision: Union[str, None] = "73f9581be055"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("collaboration_assessments", sa.Column("scores_json", sa.Text(), nullable=True))
    op.create_table(
        "collaboration_assessment_questions",
        sa.Column("assessment_id", sa.UUID(), nullable=False),
        sa.Column("question_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["assessment_id"], ["collaboration_assessments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["collaboration_questions.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("assessment_id", "question_id"),
    )
    op.create_unique_constraint(
        "uq_collaboration_answer_assessment_question",
        "collaboration_answers",
        ["assessment_id", "question_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_collaboration_answer_assessment_question", "collaboration_answers", type_="unique")
    op.drop_table("collaboration_assessment_questions")
    op.drop_column("collaboration_assessments", "scores_json")
