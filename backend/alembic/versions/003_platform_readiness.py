"""Platform readiness fields and query indexes.

Revision ID: 003
Revises: 002
Create Date: 2026-08-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("consent_version", sa.String(30), nullable=True))
    op.add_column("users", sa.Column("privacy_version", sa.String(30), nullable=True))
    op.create_index("ix_growth_tasks_user_task", "growth_tasks", ["user_id", "task_id"])
    op.create_index(
        "ix_evidence_user_status", "evidence", ["user_id", "verification_status"]
    )
    op.create_index(
        "ix_user_sessions_user_active", "user_sessions", ["user_id", "revoked_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_user_sessions_user_active", table_name="user_sessions")
    op.drop_index("ix_evidence_user_status", table_name="evidence")
    op.drop_index("ix_growth_tasks_user_task", table_name="growth_tasks")
    op.drop_column("users", "privacy_version")
    op.drop_column("users", "consent_version")
