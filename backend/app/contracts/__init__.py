"""
Cross-group contract schemas.

These Pydantic models define the stable data boundaries between Group1, Group2,
Group3, and Shared/Core. All inter-module data exchange MUST use these types.

DO NOT:
  - Bypass contracts by importing another module's SQLAlchemy model directly
  - Create your own version of a contract that already exists
  - Add fictional business fields that don't exist in the data model

DO:
  - Import from app.contracts.* for cross-module data passing
  - Extend contracts with new fields via PR + review
"""

from .student import (
    StudentSummary,
    StudentAcademicProfile,
    StudentCareerIntent,
)
from .portrait import (
    StudentPortraitSummary,
    GrowthProgressSummary,
    DimensionScore,
    WeaknessItem,
)
from .role_model import RoleModelMatchSummary
from .job import (
    JobSummary,
    JobRequirementProfile,
    JobRequirementItem,
)
from .resume import GeneratedResumeSummary
from .interview import InterviewAssessmentSummary
from .matching import JobMatchRequest, JobMatchResult, JobGapItem

__all__ = [
    # Student (Shared → All)
    "StudentSummary",
    "StudentAcademicProfile",
    "StudentCareerIntent",
    # Portrait (Group2 → Group1, Group3)
    "StudentPortraitSummary",
    "GrowthProgressSummary",
    "DimensionScore",
    "WeaknessItem",
    # Role Model (Group2 → All)
    "RoleModelMatchSummary",
    # Job (Group3 → Group1, Group2)
    "JobSummary",
    "JobRequirementProfile",
    "JobRequirementItem",
    # Resume (Group1 → Group3)
    "GeneratedResumeSummary",
    # Interview (Group1 → Group3)
    "InterviewAssessmentSummary",
    # Matching (Group3 → Group1, Group2)
    "JobMatchRequest",
    "JobMatchResult",
    "JobGapItem",
]
