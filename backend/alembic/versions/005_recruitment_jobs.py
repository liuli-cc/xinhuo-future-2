"""Enterprise-owned jobs, job applications and interview invitations."""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("recruitment_jobs",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("enterprise_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("department", sa.String(100), nullable=False),
        sa.Column("location", sa.String(160), nullable=False),
        sa.Column("employment_type", sa.String(40), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("requirements", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_recruitment_jobs_enterprise_id", "recruitment_jobs", ["enterprise_id"])
    with op.batch_alter_table("recruitment_applications") as batch:
        batch.add_column(sa.Column("job_id", sa.String(64), nullable=True))
        batch.add_column(sa.Column("application_key", sa.String(160), nullable=True))
        batch.add_column(sa.Column("interview", sa.JSON(), nullable=True))
    applications = sa.table("recruitment_applications", sa.column("id", sa.String), sa.column("enterprise_id", sa.Integer), sa.column("resume_id", sa.String), sa.column("application_key", sa.String))
    connection = op.get_bind()
    rows = connection.execute(sa.select(applications.c.id, applications.c.enterprise_id, applications.c.resume_id)).all()
    for application_id, enterprise_id, resume_id in rows:
        connection.execute(applications.update().where(applications.c.id == application_id).values(application_key=f"enterprise-{enterprise_id}-{resume_id}"))
    with op.batch_alter_table("recruitment_applications") as batch:
        batch.drop_constraint("uq_recruitment_submission", type_="unique")
        batch.alter_column("application_key", existing_type=sa.String(160), nullable=False)
        batch.create_unique_constraint("uq_recruitment_application_key", ["student_id", "application_key"])
        batch.create_foreign_key("fk_recruitment_application_job", "recruitment_jobs", ["job_id"], ["id"])
        batch.create_index("ix_recruitment_applications_job_id", ["job_id"])


def downgrade():
    # Multiple job submissions to one employer cannot fit the old uniqueness
    # rule. Refuse a lossy downgrade rather than silently delete applications.
    conn = op.get_bind()
    duplicate = conn.execute(sa.text("SELECT student_id, enterprise_id, resume_id FROM recruitment_applications GROUP BY student_id, enterprise_id, resume_id HAVING COUNT(*) > 1")).first()
    if duplicate:
        raise RuntimeError("Cannot downgrade: multiple job applications would collide. Export and reconcile them first.")
    with op.batch_alter_table("recruitment_applications") as batch:
        batch.drop_index("ix_recruitment_applications_job_id")
        batch.drop_constraint("fk_recruitment_application_job", type_="foreignkey")
        batch.drop_constraint("uq_recruitment_application_key", type_="unique")
        batch.drop_column("interview")
        batch.drop_column("application_key")
        batch.drop_column("job_id")
        batch.create_unique_constraint("uq_recruitment_submission", ["student_id", "enterprise_id", "resume_id"])
    op.drop_table("recruitment_jobs")
