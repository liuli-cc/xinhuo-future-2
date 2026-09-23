from sqlalchemy import ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from ...db.base import Base, TimestampMixin


class RecruitmentJob(Base, TimestampMixin):
    __tablename__ = "recruitment_jobs"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    enterprise_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    department: Mapped[str] = mapped_column(String(100), default="")
    location: Mapped[str] = mapped_column(String(160))
    employment_type: Mapped[str] = mapped_column(String(40), default="实习")
    description: Mapped[str] = mapped_column(Text)
    requirements: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open")


class Application(Base, TimestampMixin):
    __tablename__ = "recruitment_applications"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    enterprise_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    resume_id: Mapped[str] = mapped_column(ForeignKey("generated_resumes.id"))
    job_id: Mapped[str | None] = mapped_column(ForeignKey("recruitment_jobs.id"), nullable=True, index=True)
    # A non-null key gives general applications and job applications the same
    # concurrency-safe uniqueness rule on both MySQL and SQLite.
    application_key: Mapped[str] = mapped_column(String(160))
    snapshot: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="待查看")
    interview: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    __table_args__ = (UniqueConstraint("student_id", "application_key", name="uq_recruitment_application_key"),)
