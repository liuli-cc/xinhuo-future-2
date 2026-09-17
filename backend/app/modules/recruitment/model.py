from sqlalchemy import ForeignKey, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from ...db.base import Base, TimestampMixin


class Application(Base, TimestampMixin):
    __tablename__ = "recruitment_applications"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    enterprise_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    resume_id: Mapped[str] = mapped_column(ForeignKey("generated_resumes.id"))
    snapshot: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="待查看")
    __table_args__ = (UniqueConstraint("student_id", "enterprise_id", "resume_id", name="uq_recruitment_submission"),)
