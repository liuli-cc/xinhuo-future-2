"""Employment module v2: shared job board, campus announcements, two-layer
application states, split favorites.  See docs/G3-EMPLOYMENT-DESIGN.md.

Revision ID: 005
Revises: 004
Create Date: 2026-08-29
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 旧 7 态 → 新两层（stage, outcome）
_STATUS_MAP = {
    "saved": ("saved", None),
    "applied": ("applied", None),
    "written_test": ("written_test_pending", None),
    "interview": ("interview_pending", None),
    "offer": ("offer", None),
    "rejected": ("offer", "rejected"),  # 终止前所在阶段无从考证，按已到 offer 前处理为 applied
    "withdrawn": ("applied", "withdrawn"),
}

_STAGE_COLUMNS = (
    sa.Column("stage", sa.String(30), nullable=False, server_default="saved",
              comment="阶段: saved | applied | written_test_pending | written_test | interview_pending | interview | offer"),
    sa.Column("outcome", sa.String(20), nullable=True,
              comment="结束原因: rejected(未通过) | withdrawn(已终止)"),
    sa.Column("closed_at", sa.BigInteger(), nullable=True, comment="结束时间戳"),
)


def _status_to_stage_status_sql(column: str) -> sa.TextClause:
    return sa.text(
        f"""CASE {column}
            WHEN 'saved' THEN 'saved'
            WHEN 'applied' THEN 'applied'
            WHEN 'written_test' THEN 'written_test_pending'
            WHEN 'interview' THEN 'interview_pending'
            WHEN 'offer' THEN 'offer'
            ELSE 'applied' END"""
    )


def _status_to_outcome_status_sql(column: str) -> sa.TextClause:
    return sa.text(
        f"""CASE {column}
            WHEN 'rejected' THEN 'rejected'
            WHEN 'withdrawn' THEN 'withdrawn'
            ELSE NULL END"""
    )


def upgrade() -> None:
    # ── users: 就业管理授权标志 ─────────────────────────────
    op.add_column("users", sa.Column(
        "employment_admin", sa.Boolean(), nullable=False, server_default="0",
        comment="就业管理授权（可导入/治理岗位与公告）",
    ))

    # ── career_jobs: 个人快照 → 共享岗位表 ───────────────────
    op.alter_column("career_jobs", "user_id", new_column_name="created_by",
                    existing_type=sa.Integer())
    op.add_column("career_jobs", sa.Column(
        "category", sa.String(20), nullable=False, server_default="social",
        comment="招聘类别: intern | campus | social"))
    op.add_column("career_jobs", sa.Column("majors_text", sa.String(500), nullable=True, comment="专业限制原文"))
    op.add_column("career_jobs", sa.Column("industries", sa.String(200), nullable=True, comment="行业标签（逗号分隔）"))
    op.add_column("career_jobs", sa.Column("company_nature", sa.String(40), nullable=True, comment="企业性质"))
    op.add_column("career_jobs", sa.Column("published_at", sa.BigInteger(), nullable=True, comment="发布/录入时间戳"))
    op.add_column("career_jobs", sa.Column("deadline", sa.BigInteger(), nullable=True, comment="截止时间戳"))
    op.add_column("career_jobs", sa.Column("source", sa.String(20), nullable=False, server_default="custom", comment="来源: import | school_coop | custom"))
    op.add_column("career_jobs", sa.Column("visibility", sa.String(20), nullable=False, server_default="public", comment="可见性: public | private"))
    op.add_column("career_jobs", sa.Column("status", sa.String(20), nullable=False, server_default="active", comment="上架状态: active | offline"))
    op.add_column("career_jobs", sa.Column("requirement_profile", sa.JSON(), nullable=True, comment="AI 结构化需求档案"))
    op.create_index("ix_career_jobs_category", "career_jobs", ["category"])
    op.create_index("ix_career_jobs_published_at", "career_jobs", ["published_at"])
    # 存量数据：学生导入的快照 → 自定义岗位（private），类别按旧 employment_type 推断
    op.execute("""
        UPDATE career_jobs SET
            source = 'custom',
            visibility = 'private',
            category = CASE
                WHEN employment_type LIKE '%实习%' OR employment_type LIKE '%兼职%' OR employment_type LIKE '%科研助理%' THEN 'intern'
                WHEN employment_type LIKE '%校招%' OR title LIKE '%届%' OR title LIKE '%校招%' THEN 'campus'
                ELSE 'social' END,
            published_at = UNIX_TIMESTAMP(created_at) * 1000
    """)

    # ── career_announcements: 校招公告 ─────────────────────
    op.create_table(
        "career_announcements",
        sa.Column("id", sa.String(64), primary_key=True, comment="UUID主键"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, comment="录入人ID"),
        sa.Column("title", sa.String(200), nullable=False, comment="简章标题"),
        sa.Column("company", sa.String(80), nullable=False, comment="公司名称"),
        sa.Column("employer_id", sa.Integer(), sa.ForeignKey("employers.id"), nullable=True, comment="企业ID"),
        sa.Column("city_text", sa.String(300), nullable=True, comment="工作城市（逗号分隔原文）"),
        sa.Column("cohort", sa.String(20), nullable=True, comment="届数，如 27届"),
        sa.Column("positions_text", sa.Text(), nullable=True, comment="招聘岗位清单原文"),
        sa.Column("industries", sa.String(200), nullable=True, comment="行业标签（逗号分隔）"),
        sa.Column("company_nature", sa.String(40), nullable=True, comment="企业性质"),
        sa.Column("detail_url", sa.String(500), nullable=True, comment="详情链接"),
        sa.Column("apply_url", sa.String(500), nullable=True, comment="投递链接"),
        sa.Column("description", sa.Text(), nullable=True, comment="公司描述/备注"),
        sa.Column("published_at", sa.BigInteger(), nullable=True, comment="发布/录入时间戳"),
        sa.Column("deadline", sa.BigInteger(), nullable=True, comment="截止时间戳"),
        sa.Column("source", sa.String(20), nullable=False, server_default="import", comment="来源: import | school_coop"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active", comment="上架状态: active | offline"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        comment="校招公告",
    )
    op.create_index("ix_career_announcements_cohort", "career_announcements", ["cohort"])
    op.create_index("ix_career_announcements_published_at", "career_announcements", ["published_at"])

    # ── 投递两层状态：stage + outcome ───────────────────────
    op.add_column("career_applications", _STAGE_COLUMNS[0])
    op.add_column("career_applications", _STAGE_COLUMNS[1])
    op.add_column("career_applications", _STAGE_COLUMNS[2])
    op.execute("""
        UPDATE career_applications SET
            stage = CASE status
                WHEN 'saved' THEN 'saved'
                WHEN 'applied' THEN 'applied'
                WHEN 'written_test' THEN 'written_test_pending'
                WHEN 'interview' THEN 'interview_pending'
                WHEN 'offer' THEN 'offer'
                ELSE 'applied' END,
            outcome = CASE status
                WHEN 'rejected' THEN 'rejected'
                WHEN 'withdrawn' THEN 'withdrawn'
                ELSE NULL END,
            closed_at = CASE WHEN status IN ('rejected','withdrawn')
                THEN UNIX_TIMESTAMP(updated_at) * 1000 ELSE NULL END
    """)
    op.create_index("ix_career_applications_stage", "career_applications", ["stage"])
    op.drop_column("career_applications", "status")

    # 事件表：status → stage（历史值同步映射）
    op.alter_column("career_events", "status", new_column_name="stage", existing_type=sa.String(30))
    op.execute("""
        UPDATE career_events SET stage = CASE stage
            WHEN 'written_test' THEN 'written_test_pending'
            WHEN 'interview' THEN 'interview_pending'
            ELSE stage END
    """)

    # ── 公告投递 ───────────────────────────────────────────
    op.create_table(
        "career_announcement_applications",
        sa.Column("id", sa.String(64), primary_key=True, comment="UUID主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, comment="用户ID"),
        sa.Column("announcement_id", sa.String(64), sa.ForeignKey("career_announcements.id"), nullable=False, comment="公告ID"),
        sa.Column("stage", sa.String(30), nullable=False, server_default="saved", comment="阶段"),
        sa.Column("outcome", sa.String(20), nullable=True, comment="结束原因: rejected | withdrawn"),
        sa.Column("closed_at", sa.BigInteger(), nullable=True, comment="结束时间戳"),
        sa.Column("note", sa.Text(), nullable=True, comment="最近一次复盘"),
        sa.Column("submitted_at", sa.BigInteger(), nullable=True, comment="投递时间戳"),
        sa.Column("last_event_at", sa.BigInteger(), nullable=True, comment="最后事件时间戳"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        comment="校招公告投递记录",
    )
    op.create_index("ix_career_announcement_applications_stage", "career_announcement_applications", ["stage"])

    op.create_table(
        "career_announcement_events",
        sa.Column("id", sa.String(64), primary_key=True, comment="UUID主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, comment="用户ID"),
        sa.Column("application_id", sa.String(64), sa.ForeignKey("career_announcement_applications.id"), nullable=False, comment="公告投递记录ID"),
        sa.Column("stage", sa.String(30), nullable=False, comment="阶段（进入的阶段）"),
        sa.Column("note", sa.Text(), nullable=True, comment="复盘/备注"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        comment="公告投递事件/复盘记录",
    )

    # ── 收藏（岗位/公告各一张） ─────────────────────────────
    op.create_table(
        "career_favorites",
        sa.Column("id", sa.String(64), primary_key=True, comment="UUID主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, comment="用户ID"),
        sa.Column("job_id", sa.String(64), sa.ForeignKey("career_jobs.id"), nullable=False, comment="岗位ID"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "job_id", name="uq_career_favorites_user_job"),
        comment="岗位收藏",
    )
    op.create_table(
        "career_announcement_favorites",
        sa.Column("id", sa.String(64), primary_key=True, comment="UUID主键"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, comment="用户ID"),
        sa.Column("announcement_id", sa.String(64), sa.ForeignKey("career_announcements.id"), nullable=False, comment="公告ID"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "announcement_id", name="uq_career_ann_favorites_user_ann"),
        comment="校招公告收藏",
    )


def downgrade() -> None:
    op.drop_table("career_announcement_favorites")
    op.drop_table("career_favorites")
    op.drop_table("career_announcement_events")
    op.drop_table("career_announcement_applications")

    op.alter_column("career_events", "stage", new_column_name="status", existing_type=sa.String(30))
    op.add_column("career_applications", sa.Column("status", sa.String(30), nullable=False, server_default="saved"))
    op.execute("UPDATE career_applications SET status = CASE WHEN outcome IS NOT NULL THEN outcome ELSE stage END")
    op.drop_index("ix_career_applications_stage", table_name="career_applications")
    op.drop_column("career_applications", "closed_at")
    op.drop_column("career_applications", "outcome")
    op.drop_column("career_applications", "stage")

    op.drop_index("ix_career_announcements_published_at", table_name="career_announcements")
    op.drop_index("ix_career_announcements_cohort", table_name="career_announcements")
    op.drop_table("career_announcements")

    op.drop_index("ix_career_jobs_published_at", table_name="career_jobs")
    op.drop_index("ix_career_jobs_category", table_name="career_jobs")
    op.drop_column("career_jobs", "requirement_profile")
    op.drop_column("career_jobs", "status")
    op.drop_column("career_jobs", "visibility")
    op.drop_column("career_jobs", "source")
    op.drop_column("career_jobs", "deadline")
    op.drop_column("career_jobs", "published_at")
    op.drop_column("career_jobs", "company_nature")
    op.drop_column("career_jobs", "industries")
    op.drop_column("career_jobs", "majors_text")
    op.drop_column("career_jobs", "category")
    op.alter_column("career_jobs", "created_by", new_column_name="user_id", existing_type=sa.Integer())

    op.drop_column("users", "employment_admin")
