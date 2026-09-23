"""Migration preserves pre-job applications and protects against lossy rollback."""
import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text


def test_005_preserves_existing_submissions_and_rejects_lossy_downgrade():
    path = Path(__file__).parents[2] / "alembic" / "versions" / "005_recruitment_jobs.py"
    spec = importlib.util.spec_from_file_location("jobs_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as db:
        db.execute(text("CREATE TABLE users(id INTEGER PRIMARY KEY)"))
        db.execute(text("CREATE TABLE generated_resumes(id VARCHAR(64) PRIMARY KEY)"))
        db.execute(text("CREATE TABLE recruitment_applications(id VARCHAR(64) PRIMARY KEY, student_id INTEGER NOT NULL, enterprise_id INTEGER NOT NULL, resume_id VARCHAR(64) NOT NULL, snapshot JSON NOT NULL, status VARCHAR(20) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, CONSTRAINT uq_recruitment_submission UNIQUE(student_id,enterprise_id,resume_id))"))
        db.execute(text("INSERT INTO recruitment_applications VALUES('a',1,2,'r1','{}','待查看',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),('b',1,2,'r2','{}','已收藏',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
        with Operations.context(MigrationContext.configure(db)):
            migration.upgrade()
            rows = db.execute(text("SELECT application_key,status FROM recruitment_applications ORDER BY id")).all()
            assert rows == [('enterprise-2-r1', '待查看'), ('enterprise-2-r2', '已收藏')]
            db.execute(text("INSERT INTO recruitment_jobs VALUES('j',2,'岗位','','远程','实习','岗位工作描述','要求','open',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
            db.execute(text("INSERT INTO recruitment_applications (id,student_id,enterprise_id,resume_id,snapshot,status,created_at,updated_at,job_id,application_key) VALUES('c',1,2,'r1','{}','待查看',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'j','j')"))
            with pytest.raises(RuntimeError, match="Cannot downgrade"):
                migration.downgrade()
            assert db.execute(text("SELECT count(*) FROM recruitment_applications")).scalar() == 3
    engine.dispose()
