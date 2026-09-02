"""Import schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ImportBatchInfo(BaseModel):
    id: int
    source_type: str
    source_filename: str | None = None
    source_year: int | None = None
    status: str
    total_rows: int = 0
    success_rows: int = 0
    failed_rows: int = 0
    created_at: str | None = None


class ImportRowInfo(BaseModel):
    id: int
    batch_id: int
    row_number: int
    normalized_status: str
    target_table: str | None = None
    target_id: str | None = None
    error_message: str | None = None
