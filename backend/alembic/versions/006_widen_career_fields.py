"""Widen career fields for real-world data: job city, announcement URLs.

Revision ID: 006
Revises: 005
Create Date: 2026-08-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("career_jobs", "city", existing_type=sa.String(40), type_=sa.String(200),
                    comment="城市/工作地点原文")
    op.alter_column("career_announcements", "detail_url", existing_type=sa.String(500), type_=sa.String(1000))
    op.alter_column("career_announcements", "apply_url", existing_type=sa.String(500), type_=sa.String(1000))


def downgrade() -> None:
    op.alter_column("career_announcements", "apply_url", existing_type=sa.String(1000), type_=sa.String(500))
    op.alter_column("career_announcements", "detail_url", existing_type=sa.String(1000), type_=sa.String(500))
    op.alter_column("career_jobs", "city", existing_type=sa.String(200), type_=sa.String(40),
                    comment="城市")
