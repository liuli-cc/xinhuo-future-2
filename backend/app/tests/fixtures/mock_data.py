"""
Mock data generators for cross-group development.

Each function returns a valid Pydantic model instance conforming to the
cross-group contract. Used by all three groups during parallel development
when a dependency hasn't been implemented yet.

Usage:
    from app.tests.fixtures.mock_data import make_student_portrait

    # When Group1 needs portrait data but Group2 hasn't built it yet:
    mock_portrait = make_student_portrait(user_id=1)
"""

from __future__ import annotations

from app.contracts.student import StudentSummary, StudentAcademicProfile, StudentCareerIntent
from app.contracts.portrait import (
    StudentPortraitSummary,
    GrowthProgressSummary,
    DimensionScore,
    WeaknessItem,
)
from app.contracts.role_model import RoleModelMatchSummary
from app.contracts.job import (
    JobSummary,
    JobRequirementProfile,
    JobRequirementItem,
)
from app.contracts.resume import GeneratedResumeSummary
from app.contracts.interview import InterviewAssessmentSummary
from app.contracts.matching import JobMatchRequest, JobMatchResult, JobGapItem


# ── Shared/Core Fixtures ────────────────────────────────────

def make_student_summary(user_id: int = 1, **overrides) -> StudentSummary:
    """Create a mock student summary."""
    data = {
        "user_id": user_id,
        "student_no": f"2025{user_id:06d}",
        "name": f"测试学生{user_id}",
        "college": "人工智能学院",
        "major": "计算机科学与技术",
        "class_name": "2025级1班",
        "grade": "2025级",
        "role": "student",
    }
    data.update(overrides)
    return StudentSummary(**data)


def make_student_academic_profile(user_id: int = 1) -> StudentAcademicProfile:
    """Create a mock student academic profile."""
    return StudentAcademicProfile(
        user_id=user_id,
        student_no=f"2025{user_id:06d}",
        college_id=1,
        college_name="人工智能学院",
        major_program_id=1,
        major_name="计算机科学与技术",
        degree_category="工学学士",
        education_level="本科",
        enrollment_date="2025-09-01",
        graduation_date="2029-07-01",
        admission_year=2025,
        source_province="内蒙古自治区",
        filing_score=580.0,
        teaching_language="汉语",
    )


def make_student_career_intent(user_id: int = 1) -> StudentCareerIntent:
    """Create a mock student career intent."""
    return StudentCareerIntent(
        user_id=user_id,
        target_role="后端开发工程师",
        development_track="backend",
        career_interest="希望从事Java后端开发",
        career_orientation="技术研发型",
        expected_city="北京",
        expected_salary="15-25K",
        target_industries=["互联网", "人工智能"],
    )


# ── Group2 Fixtures (Portrait / Growth / RoleModel) ────────

def make_student_portrait(user_id: int = 1) -> StudentPortraitSummary:
    """Create a mock student ability portrait (Group2 output)."""
    return StudentPortraitSummary(
        user_id=user_id,
        overall_score=72,
        completeness=65,
        confidence=78,
        dimensions=[
            DimensionScore(name="专业学习", score=80, confidence=85, evidence_count=3),
            DimensionScore(name="项目实践", score=65, confidence=70, evidence_count=2),
            DimensionScore(name="创新探索", score=55, confidence=60, evidence_count=1),
            DimensionScore(name="沟通协作", score=70, confidence=75, evidence_count=2),
            DimensionScore(name="职业准备", score=60, confidence=55, evidence_count=1),
        ],
        weaknesses=[
            WeaknessItem(dimension="创新探索", gap=25, recommendation="参加一次学科竞赛"),
            WeaknessItem(dimension="职业准备", gap=20, recommendation="完成一次岗位调研"),
        ],
        total_evidence=9,
        verified_evidence=5,
        algorithm_version="XH-EGM-2.0",
        calculated_at=1750000000000,
    )


def make_growth_progress(user_id: int = 1) -> GrowthProgressSummary:
    """Create a mock growth progress summary (Group2 output)."""
    return GrowthProgressSummary(
        user_id=user_id,
        semester_index=2,
        total_tasks=12,
        completed_tasks=7,
        verified_tasks=4,
        total_xp=350,
        earned_xp=180,
        completion_rate=0.58,
        focus_dimensions=["项目实践", "职业准备"],
        recent_completions=["完成Java课程设计", "通过CET-4", "参加程序设计竞赛"],
    )


def make_role_model_match(user_id: int = 1) -> RoleModelMatchSummary:
    """Create a mock role model match (Group2 output)."""
    return RoleModelMatchSummary(
        role_model_id=1,
        display_name="2021级王学长",
        match_score=82,
        matched_dimensions=["专业学习", "项目实践"],
        match_rationale="专业背景和技能发展方向高度一致",
        background_summary="内蒙古师范大学 计算机科学与技术，现就职于字节跳动后端开发",
        final_offer="字节跳动-后端开发工程师",
        graduation_year=2025,
        key_experiences=["ACM亚洲区银奖", "字节跳动暑期实习", "开源项目贡献者"],
    )


# ── Group1 Fixtures (Resume / Interview) ────────────────────

def make_generated_resume_summary(
    user_id: int = 1, job_id: str = "job-001"
) -> GeneratedResumeSummary:
    """Create a mock generated resume summary (Group1 output)."""
    return GeneratedResumeSummary(
        resume_id="resume-001",
        user_id=user_id,
        target_job_id=job_id,
        job_title="Java后端开发工程师",
        company="某互联网公司",
        title=f"测试学生{user_id}-Java后端-某互联网公司",
        version=1,
        status="completed",
        is_current=True,
        ats_score=85,
        generated_by="deepseek",
        created_at="2026-08-10T12:00:00",
    )


def make_interview_assessment(user_id: int = 1) -> InterviewAssessmentSummary:
    """Create a mock interview assessment (Group1 output)."""
    return InterviewAssessmentSummary(
        session_id="interview-001",
        user_id=user_id,
        target_role="Java后端开发工程师",
        difficulty="标准",
        overall_score=76,
        strengths=["技术基础扎实", "项目经验有亮点"],
        weaknesses=["系统设计能力需提升", "沟通表达可更简洁"],
        communication_score=70,
        technical_score=80,
        improvement_suggestions=[
            "多做系统设计练习",
            "用STAR法则组织回答",
        ],
        answer_count=6,
        created_at="2026-08-10T14:00:00",
    )


# ── Group3 Fixtures (Job / Employer / Matching) ─────────────

def make_job_summary(job_id: str = "job-001") -> JobSummary:
    """Create a mock job summary (Group3 output)."""
    return JobSummary(
        job_id=job_id,
        title="Java后端开发工程师",
        company="某科技公司",
        city="北京",
        employment_type="校招",
        salary="15-25K",
        source_url="https://example.com/job/001",
        description_snippet="负责公司核心业务系统的后端开发，参与系统架构设计...",
    )


def make_job_requirement_profile(job_id: str = "job-001") -> JobRequirementProfile:
    """Create a mock job requirement profile (Group3 output)."""
    return JobRequirementProfile(
        job_id=job_id,
        skills=["Java", "Spring Boot", "MySQL", "Redis", "Git"],
        responsibilities=[
            "负责后端API开发与维护",
            "参与系统架构设计",
            "编写技术文档",
        ],
        experience_requirement="应届或1-2年",
        core_competencies=["问题解决能力", "沟通协作能力", "学习能力"],
        structured_requirements=[
            JobRequirementItem(label="Java/Spring", dimension="专业学习", priority="required"),
            JobRequirementItem(label="数据库与SQL", dimension="项目实践", priority="required"),
            JobRequirementItem(label="团队协作", dimension="沟通协作", priority="preferred"),
        ],
        difficulty="standard",
    )


def make_job_match_request(user_id: int = 1, job_id: str = "job-001") -> JobMatchRequest:
    """Create a complete job match request assembling all group outputs.

    This is the canonical example of how Group3 consumes data from Shared, Group1,
    and Group2 to compute a match.
    """
    return JobMatchRequest(
        user_id=user_id,
        student_profile_id=1,
        academic_profile=make_student_academic_profile(user_id).model_dump(),
        career_intent=make_student_career_intent(user_id).model_dump(),
        portrait=make_student_portrait(user_id).model_dump(),
        growth_progress=make_growth_progress(user_id).model_dump(),
        resume=make_generated_resume_summary(user_id, job_id).model_dump(),
        interview_assessment=make_interview_assessment(user_id).model_dump(),
        job_id=job_id,
        job_requirements=make_job_requirement_profile(job_id).model_dump(),
    )


def make_job_match_result(user_id: int = 1, job_id: str = "job-001") -> JobMatchResult:
    """Create a mock job match result (Group3 output)."""
    return JobMatchResult(
        match_id="match-001",
        user_id=user_id,
        job_id=job_id,
        job_title="Java后端开发工程师",
        company="某科技公司",
        overall_score=68,
        confidence=75,
        verdict="较匹配",
        skill_match_score=75,
        experience_match_score=60,
        education_match_score=80,
        potential_score=70,
        intent_match_score=65,
        gaps=[
            JobGapItem(
                dimension="项目实践",
                required_level=80,
                current_level=65,
                gap=15,
                priority="high",
                recommendation="补充一个完整的Spring Boot项目",
            ),
            JobGapItem(
                dimension="创新探索",
                required_level=60,
                current_level=55,
                gap=5,
                priority="low",
                recommendation="参加开源项目或技术博客",
            ),
        ],
        match_rationale="该生专业学习基础扎实，项目实践与岗位要求有差距但可通过短期训练弥补",
        strengths_matched=["Java基础扎实", "数据库知识达标", "学习能力强"],
        formula="技能30% + 经历25% + 学历15% + 潜力15% + 意向15%",
        calculated_at="2026-08-10T16:00:00",
    )
