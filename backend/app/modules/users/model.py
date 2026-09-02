"""
User and personnel master data layer.

users       — account credentials and shared identity
student_profiles        — student academic profile
student_private_profiles — sensitive PII (default hidden from API)
teacher_profiles        — teacher/staff profile
user_sessions           — session tokens
"""

from __future__ import annotations

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...db.base import Base, SoftDeleteMixin, TimestampMixin


class User(Base, SoftDeleteMixin):
    """Central user account — shared across students, teachers, and admins.

    Mirrors the existing xh_users collection structure.
    Sensitive fields (password, lockout) kept here but excluded from API by default.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    student_id: Mapped[str] = mapped_column(
        String(20), nullable=False, unique=True, index=True, comment="学号或工号"
    )
    name: Mapped[str] = mapped_column(String(30), nullable=False, comment="姓名")
    email: Mapped[str] = mapped_column(String(120), nullable=False, default="", comment="邮箱")
    role: Mapped[str] = mapped_column(
        String(30), nullable=False, default="student", index=True,
        comment="角色: student | teacher | counselor | college_admin | school_admin | admin"
    )
    account_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending", index=True,
        comment="账号状态: pending | active | rejected | suspended"
    )
    account_review_note: Mapped[str | None] = mapped_column(
        String(300), nullable=True, comment="审核备注"
    )
    account_reviewed_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="审核时间戳"
    )
    account_reviewed_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, comment="审核人ID"
    )
    force_password_change: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", comment="是否强制修改密码"
    )
    employment_admin: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", comment="就业管理授权（可导入/治理岗位与公告）"
    )

    # ── Credentials (never return in API) ───────────────────
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False, comment="密码散列")
    password_salt: Mapped[str] = mapped_column(String(200), nullable=False, comment="密码盐值")
    failed_login_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", comment="连续失败登录次数"
    )
    locked_until: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="锁定截止时间戳"
    )

    # ── Shared profile fields ───────────────────────────────
    college: Mapped[str] = mapped_column(String(80), nullable=False, default="", comment="院系名称")
    major: Mapped[str] = mapped_column(String(80), nullable=False, default="", comment="专业/岗位")
    class_name: Mapped[str] = mapped_column(String(80), nullable=False, default="", comment="班级")
    grade: Mapped[str] = mapped_column(String(20), nullable=False, default="", comment="年级")
    phone: Mapped[str] = mapped_column(String(30), nullable=False, default="", comment="电话")
    bio: Mapped[str] = mapped_column(Text, nullable=False, default="", comment="个人简介")

    # ── Career / Development ────────────────────────────────
    target_role: Mapped[str] = mapped_column(
        String(80), default="探索方向", comment="目标职业方向"
    )
    development_track: Mapped[str] = mapped_column(
        String(80), default="exploration", comment="发展路径"
    )
    interests: Mapped[list] = mapped_column(JSON, default=list, comment="兴趣标签")

    # ── Consent / Timestamps ────────────────────────────────
    consent_at: Mapped[int] = mapped_column(Integer, nullable=True, comment="同意协议时间戳")
    consent_version: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="同意的服务协议版本"
    )
    privacy_version: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="同意的隐私政策版本"
    )
    last_login_at: Mapped[int | None] = mapped_column(Integer, nullable=True, comment="最后登录时间戳")

    # Relationships
    student_profile: Mapped["StudentProfile | None"] = relationship(
        back_populates="user", uselist=False, lazy="selectin"
    )
    teacher_profile: Mapped["TeacherProfile | None"] = relationship(
        back_populates="user", uselist=False, lazy="selectin"
    )
    sessions: Mapped[list["UserSession"]] = relationship(back_populates="user", lazy="selectin")

    __table_args__ = (
        {"comment": "用户账号"}
    )


class StudentProfile(Base, TimestampMixin):
    """Student academic profile — business identity separate from account."""

    __tablename__ = "student_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True, comment="用户ID"
    )
    student_no: Mapped[str] = mapped_column(
        String(20), nullable=False, unique=True, index=True, comment="学号"
    )
    candidate_no: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="考生号"
    )
    college_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("colleges.id"), nullable=True, comment="学院ID"
    )
    major_program_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("university_major_programs.id"), nullable=True, comment="专业ID"
    )
    class_name: Mapped[str | None] = mapped_column(String(80), nullable=True, comment="班级")
    enrollment_date: Mapped[str | None] = mapped_column(
        String(10), nullable=True, comment="入学日期"
    )
    graduation_date: Mapped[str | None] = mapped_column(
        String(10), nullable=True, comment="预计毕业日期"
    )
    education_level: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="学历层次"
    )
    study_mode: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="学习形式"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="active", server_default="'active'", comment="学籍状态"
    )

    user: Mapped["User"] = relationship(back_populates="student_profile")
    private_profile: Mapped["StudentPrivateProfile | None"] = relationship(
        back_populates="student_profile", uselist=False, lazy="selectin"
    )

    __table_args__ = (
        {"comment": "学生档案"}
    )


class StudentPrivateProfile(Base, TimestampMixin):
    """Sensitive PII for students — segregated for privacy & access control.

    API default: NOT returned. Logging: REDACTED. Storage: encryption-ready.
    """

    __tablename__ = "student_private_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("student_profiles.id"), nullable=False, unique=True, index=True,
        comment="学生档案ID"
    )
    real_name: Mapped[str] = mapped_column(String(30), nullable=False, comment="真实姓名")
    id_card: Mapped[str | None] = mapped_column(
        String(18), nullable=True, comment="身份证号（加密存储）"
    )
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True, comment="性别")
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="手机号")
    email: Mapped[str | None] = mapped_column(String(120), nullable=True, comment="邮箱")
    qq: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="QQ")
    household_location: Mapped[str | None] = mapped_column(
        String(300), nullable=True, comment="户籍所在地"
    )
    address: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="现住址")
    ethnicity: Mapped[str | None] = mapped_column(String(30), nullable=True, comment="民族")
    political_status: Mapped[str | None] = mapped_column(
        String(30), nullable=True, comment="政治面貌"
    )

    student_profile: Mapped["StudentProfile"] = relationship(back_populates="private_profile")

    __table_args__ = (
        {"comment": "学生敏感个人信息（默认不返回）"}
    )


class TeacherProfile(Base, TimestampMixin):
    """Teacher / staff profile."""

    __tablename__ = "teacher_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, comment="主键")
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True, comment="用户ID"
    )
    staff_no: Mapped[str] = mapped_column(
        String(20), nullable=False, unique=True, comment="工号"
    )
    college_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("colleges.id"), nullable=True, comment="学院ID"
    )
    title: Mapped[str | None] = mapped_column(String(40), nullable=True, comment="职称")
    position: Mapped[str | None] = mapped_column(String(80), nullable=True, comment="职务")
    office: Mapped[str | None] = mapped_column(String(120), nullable=True, comment="办公室")
    is_mentor: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="0", comment="是否导师"
    )

    user: Mapped["User"] = relationship(back_populates="teacher_profile")

    __table_args__ = (
        {"comment": "教师档案"}
    )


class UserSession(Base, TimestampMixin):
    """Active login session.

    Session ID is SHA-256(token). Expiry and revoke support built in.
    """

    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, comment="会话ID = SHA256(token)"
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID"
    )
    expires_at: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="过期时间戳"
    )
    last_seen_at: Mapped[int] = mapped_column(Integer, nullable=False, comment="最后活跃时间戳")
    revoked_at: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="撤销时间戳"
    )
    device_id: Mapped[str | None] = mapped_column(String(80), nullable=True, comment="设备ID")
    device_name: Mapped[str | None] = mapped_column(String(80), nullable=True, comment="设备名称")
    user_agent_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, comment="UA摘要")
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, comment="IP摘要")

    user: Mapped["User"] = relationship(back_populates="sessions")

    __table_args__ = (
        {"comment": "用户会话"}
    )
