"""Add employer link and tags to career_jobs.

Revision ID: 004
Revises: 003
Create Date: 2026-08-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("career_jobs", sa.Column("employer_id", sa.Integer(), nullable=True))
    op.add_column("career_jobs", sa.Column("tags", sa.JSON(), nullable=True))
    op.create_index("ix_career_jobs_employer_id", "career_jobs", ["employer_id"])
    op.create_foreign_key(
        "fk_career_jobs_employer_id",
        "career_jobs",
        "employers",
        ["employer_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_career_jobs_employer_id", "career_jobs", type_="foreignkey")
    op.drop_index("ix_career_jobs_employer_id", table_name="career_jobs")
    op.drop_column("career_jobs", "tags")
    op.drop_column("career_jobs", "employer_id")
