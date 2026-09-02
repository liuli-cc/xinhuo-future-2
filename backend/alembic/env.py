"""Alembic env.py — async migration support for SQLAlchemy 2.0.

Called by Alembic to run migrations in both online and offline modes.
"""

import asyncio
import os
import sys
from logging.config import fileConfig

# Ensure the backend/app is on the path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.db.base import Base

# Import ALL models so Alembic can detect them
from app.modules.reference.model import RefMajorStandard, RefJobStandard, RefCodeValue
from app.modules.organization.model import University, College, UniversityMajorProgram
from app.modules.users.model import User, StudentProfile, StudentPrivateProfile, TeacherProfile, UserSession
from app.modules.admission.model import StudentAdmission, StudentAdmissionScore
from app.modules.employment.model import Employer, StudentEmployment, EmploymentReview, StudyAbroadRecord, GraduateAdministration
from app.modules.evidence.model import Evidence, EvidenceReview, EvidenceFile
from app.modules.growth.model import (
    GrowthTask, CloudState,
    BaselineAssessment, StudentPortrait, GrowthPlan, GrowthTaskProgress,
    RoleModel, RoleModelExperience, RoleModelMilestone, RoleModelMatch,
)
from app.modules.career.model import (
    CareerJob, CareerMatch, CareerApplication, CareerEvent, RecommendationFeedback,
    CandidatePush, StudentDataAuthorization,
)
from app.modules.resume.model import GeneratedResume, ResumeTemplate
from app.modules.interview.model import InterviewSession, ResumeUploadChunk
from app.modules.admin.model import AuditLog, RecoveryRequest, DeletionRequest
from app.modules.files.model import File
from app.modules.imports.model import DataImportBatch, DataImportRow

# Alembic Config object
config = context.config

# Set up logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# MetaData for autogenerate
target_metadata = Base.metadata


def get_url() -> str:
    """Get database URL from environment or alembic.ini."""
    url = os.getenv("DATABASE_URL", "")
    if not url:
        url = config.get_main_option("sqlalchemy.url", "")
    # Convert sync URL to async for running migrations
    return url.replace("mysql+pymysql://", "mysql+aiomysql://")


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generate SQL script)."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connected to database)."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
