"""Consent-based enterprise applications."""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("recruitment_applications",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("enterprise_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("resume_id", sa.String(64), sa.ForeignKey("generated_resumes.id"), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("student_id", "enterprise_id", "resume_id", name="uq_recruitment_submission"),
    )
    op.create_index("ix_recruitment_applications_student_id", "recruitment_applications", ["student_id"])
    op.create_index("ix_recruitment_applications_enterprise_id", "recruitment_applications", ["enterprise_id"])


def downgrade():
    op.drop_table("recruitment_applications")
