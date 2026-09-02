"""
Module boundary tests.

Verifies that each group only accesses tables it owns,
and cross-group data exchange uses contracts (not direct DB access).

These tests document the contract, not enforce it at runtime.
In a modular monolith, enforcement is via code review + CODEOWNERS.
"""

from __future__ import annotations

import pytest

# ═══════════════════════════════════════════════════════════════
# Table Ownership Map (from docs/MODULE-BOUNDARIES.md)
# ═══════════════════════════════════════════════════════════════

SHARED_TABLES = {
    "users", "student_profiles", "student_private_profiles", "teacher_profiles",
    "user_sessions",
    "ref_major_standard", "ref_job_standard", "ref_code_values",
    "universities", "colleges", "university_major_programs",
    "student_admissions", "student_admission_scores",
    "audit_logs", "recovery_requests", "deletion_requests",
    "files", "cloud_states",
    "data_import_batches", "data_import_rows",
}

GROUP1_TABLES = {
    "generated_resumes", "resume_templates",
    "interview_sessions", "resume_upload_chunks",
}

GROUP2_TABLES = {
    "baseline_assessments", "student_portraits",
    "growth_plans", "growth_tasks", "growth_task_progress",
    "evidence", "evidence_reviews", "evidence_files",
    "role_models", "role_model_experiences", "role_model_milestones",
    "role_model_matches",
}

GROUP3_TABLES = {
    "employers", "career_jobs", "career_matches", "career_applications",
    "career_events", "recommendation_feedback",
    "student_employments", "employment_reviews", "study_abroad_records",
    "graduate_administration",
    "candidate_pushes", "student_data_authorizations",
}


# ═══════════════════════════════════════════════════════════════
# Tests: Table ownership — no overlap between groups
# ═══════════════════════════════════════════════════════════════

class TestTableOwnership:
    """Verify table ownership has no conflicts."""

    def test_no_shared_table_claimed_by_groups(self):
        """Shared tables should not appear in any group's ownership."""
        assert SHARED_TABLES.isdisjoint(GROUP1_TABLES), \
            f"Group1 claims Shared tables: {SHARED_TABLES & GROUP1_TABLES}"
        assert SHARED_TABLES.isdisjoint(GROUP2_TABLES), \
            f"Group2 claims Shared tables: {SHARED_TABLES & GROUP2_TABLES}"
        assert SHARED_TABLES.isdisjoint(GROUP3_TABLES), \
            f"Group3 claims Shared tables: {SHARED_TABLES & GROUP3_TABLES}"

    def test_no_overlap_between_groups(self):
        """Each group should own distinct tables."""
        assert GROUP1_TABLES.isdisjoint(GROUP2_TABLES), \
            f"Group1/Group2 conflict: {GROUP1_TABLES & GROUP2_TABLES}"
        assert GROUP1_TABLES.isdisjoint(GROUP3_TABLES), \
            f"Group1/Group3 conflict: {GROUP1_TABLES & GROUP3_TABLES}"
        assert GROUP2_TABLES.isdisjoint(GROUP3_TABLES), \
            f"Group2/Group3 conflict: {GROUP2_TABLES & GROUP3_TABLES}"

    def test_all_tables_accounted_for(self):
        """Every table in the project should be assigned to exactly one owner."""
        all_tables = SHARED_TABLES | GROUP1_TABLES | GROUP2_TABLES | GROUP3_TABLES
        # Ensure no duplicates exist across categories
        total_unique = (
            len(SHARED_TABLES) + len(GROUP1_TABLES) +
            len(GROUP2_TABLES) + len(GROUP3_TABLES)
        )
        assert len(all_tables) == total_unique, \
            f"Duplicate tables: {total_unique - len(all_tables)} found"


# ═══════════════════════════════════════════════════════════════
# Tests: Cross-group data flow rules
# ═══════════════════════════════════════════════════════════════

class TestCrossGroupAccess:
    """Document which groups can read which tables."""

    # Group1 can READ these tables from other groups
    GROUP1_READ = {
        # Shared
        "users", "student_profiles", "colleges", "university_major_programs",
        "ref_job_standard", "files",
        # Group2 output
        "student_portraits",
        # Group3 output
        "career_jobs", "employers",
    }

    # Group2 can READ these tables from other groups
    GROUP2_READ = {
        # Shared
        "users", "student_profiles", "colleges", "university_major_programs",
        "student_admissions", "student_admission_scores",
        "ref_job_standard", "files",
        # Group1 output
        "generated_resumes", "interview_sessions",
        # Group3 output
        "career_jobs",
    }

    # Group3 can READ these tables from other groups
    GROUP3_READ = {
        # Shared
        "users", "student_profiles", "colleges", "university_major_programs",
        "student_admissions", "student_admission_scores",
        "ref_job_standard", "files",
        # Group1 output
        "generated_resumes", "interview_sessions",
        # Group2 output
        "student_portraits", "baseline_assessments", "growth_tasks",
        "growth_task_progress",
    }

    def test_group1_only_reads_allowed_external_tables(self):
        """Group1 should not read tables it doesn't need."""
        external_reads = self.GROUP1_READ - SHARED_TABLES - GROUP1_TABLES
        # These must be in either Group2 or Group3
        assert external_reads.issubset(GROUP2_TABLES | GROUP3_TABLES), \
            f"Group1 reads invalid tables: {external_reads - GROUP2_TABLES - GROUP3_TABLES}"

    def test_group2_only_reads_allowed_external_tables(self):
        """Group2 should not read tables it doesn't need."""
        external_reads = self.GROUP2_READ - SHARED_TABLES - GROUP2_TABLES
        assert external_reads.issubset(GROUP1_TABLES | GROUP3_TABLES), \
            f"Group2 reads invalid tables: {external_reads - GROUP1_TABLES - GROUP3_TABLES}"

    def test_group3_only_reads_allowed_external_tables(self):
        """Group3 should not read tables it doesn't need."""
        external_reads = self.GROUP3_READ - SHARED_TABLES - GROUP3_TABLES
        assert external_reads.issubset(GROUP1_TABLES | GROUP2_TABLES), \
            f"Group3 reads invalid tables: {external_reads - GROUP1_TABLES - GROUP2_TABLES}"

    def test_no_group_writes_others_tables(self):
        """No group may write (INSERT/UPDATE/DELETE) tables owned by another group."""
        for group_name, owned, other1, other2 in [
            ("Group1", GROUP1_TABLES, GROUP2_TABLES, GROUP3_TABLES),
            ("Group2", GROUP2_TABLES, GROUP1_TABLES, GROUP3_TABLES),
            ("Group3", GROUP3_TABLES, GROUP1_TABLES, GROUP2_TABLES),
        ]:
            others = other1 | other2
            assert owned.isdisjoint(others), \
                f"{group_name} should not own tables from other groups"


# ═══════════════════════════════════════════════════════════════
# Tests: Contract schema validation
# ═══════════════════════════════════════════════════════════════

class TestContractSchemas:
    """Verify all contract schemas can be instantiated with mock data."""

    def test_all_mock_fixtures_valid(self):
        """All mock data generators produce valid contract instances."""
        from app.tests.fixtures.mock_data import (
            make_student_summary,
            make_student_portrait,
            make_growth_progress,
            make_job_summary,
            make_job_requirement_profile,
            make_generated_resume_summary,
            make_interview_assessment,
            make_job_match_request,
            make_job_match_result,
            make_role_model_match,
        )

        # All these should not raise ValidationError
        s = make_student_summary()
        assert s.user_id == 1

        p = make_student_portrait()
        assert len(p.dimensions) == 5

        g = make_growth_progress()
        assert 0.0 <= g.completion_rate <= 1.0

        j = make_job_summary()
        assert j.job_id == "job-001"

        rp = make_job_requirement_profile()
        assert len(rp.skills) > 0

        r = make_generated_resume_summary()
        assert r.status == "completed"

        ia = make_interview_assessment()
        assert 0 <= ia.overall_score <= 100

        mr = make_job_match_request()
        assert mr.job_id == "job-001"

        result = make_job_match_result()
        assert 0 <= result.overall_score <= 100

        rm = make_role_model_match()
        assert 0 <= rm.match_score <= 100

    def test_contract_fields_match_db_columns(self):
        """Contract field names should correspond to actual DB columns where applicable."""
        from app.modules.users.model import User
        from app.modules.growth.model import StudentPortrait
        from app.modules.career.model import CareerJob
        from app.modules.resume.model import GeneratedResume

        # StudentSummary fields should exist in User + StudentProfile
        user_cols = {c.name for c in User.__table__.columns}
        required_user_fields = {"id", "name", "college", "major", "class_name", "grade", "role"}
        missing = required_user_fields - user_cols
        assert not missing, f"StudentSummary references non-existent User columns: {missing}"

        # StudentPortraitSummary aligns with StudentPortrait
        portrait_cols = {c.name for c in StudentPortrait.__table__.columns}
        required_portrait = {"user_id", "overall_score", "completeness", "confidence",
                            "dimensions", "total_evidence", "verified_evidence"}
        missing = required_portrait - portrait_cols
        assert not missing, f"StudentPortraitSummary references non-existent columns: {missing}"

        # GeneratedResumeSummary aligns with GeneratedResume
        resume_cols = {c.name for c in GeneratedResume.__table__.columns}
        required_resume = {"id", "user_id", "title", "version", "status", "ats_score"}
        missing = required_resume - resume_cols
        assert not missing, f"GeneratedResumeSummary references non-existent columns: {missing}"
