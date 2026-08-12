"""Import every model once so metadata-based tests and tools see the full schema."""

from ..modules.admin.model import AuditLog, DeletionRequest, RecoveryRequest
from ..modules.admission.model import *  # noqa: F403
from ..modules.career.model import *  # noqa: F403
from ..modules.employment.model import *  # noqa: F403
from ..modules.evidence.model import Evidence, EvidenceFile, EvidenceReview
from ..modules.files.model import File
from ..modules.growth.model import *  # noqa: F403
from ..modules.imports.model import *  # noqa: F403
from ..modules.interview.model import InterviewSession, ResumeUploadChunk
from ..modules.organization.model import *  # noqa: F403
from ..modules.reference.model import *  # noqa: F403
from ..modules.resume.model import GeneratedResume, ResumeTemplate
from ..modules.users.model import StudentPrivateProfile, StudentProfile, TeacherProfile, User, UserSession

__all__ = [
    "AuditLog", "DeletionRequest", "RecoveryRequest", "Evidence", "EvidenceFile",
    "EvidenceReview", "File", "InterviewSession", "ResumeUploadChunk", "GeneratedResume",
    "ResumeTemplate", "StudentPrivateProfile", "StudentProfile", "TeacherProfile", "User",
    "UserSession",
]
