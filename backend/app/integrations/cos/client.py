"""
Tencent Cloud COS (Cloud Object Storage) integration stub.

Phase 1: stub with metadata-only file tracking.
Phase 2: full COS upload/download with pre-signed URLs.
"""

from __future__ import annotations

from ...core.config import get_settings


class COSClient:
    """Wraps Tencent COS SDK operations.

    Currently in Phase 1 (stub) — file metadata is stored in MySQL
    files table. Phase 2 will add actual COS upload/download.
    """

    def __init__(self):
        settings = get_settings()
        self.secret_id = settings.COS_SECRET_ID
        self.secret_key = settings.COS_SECRET_KEY
        self.bucket = settings.COS_BUCKET
        self.region = settings.COS_REGION
        self._configured = bool(self.secret_id and self.secret_key and self.bucket)

    @property
    def is_configured(self) -> bool:
        return self._configured

    def generate_object_key(self, owner_type: str, file_id: str, filename: str) -> str:
        """Generate a deterministic COS object key.

        Pattern: {owner_type}/{year}/{month}/{file_id}/{filename}
        """
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        return (
            f"{owner_type}/{now.year:04d}/{now.month:02d}/"
            f"{file_id}/{filename}"
        )

    async def upload(self, object_key: str, data: bytes, mime_type: str) -> str:
        """Upload data to COS. Returns the object URL.

        Phase 1: Raises NotImplementedError — COS not configured yet.
        Phase 2: Full implementation with SDK.
        """
        if not self._configured:
            raise NotImplementedError(
                "COS upload is not configured. Set COS_SECRET_ID, COS_SECRET_KEY, "
                "and COS_BUCKET environment variables."
            )
        # TODO Phase 2: Implement with cos-python-sdk-v5
        raise NotImplementedError("COS upload not implemented yet (Phase 2)")

    async def get_presigned_url(self, object_key: str, expires: int = 3600) -> str:
        """Generate a pre-signed download URL.

        Phase 2: Full implementation.
        """
        if not self._configured:
            raise NotImplementedError("COS not configured")
        raise NotImplementedError("COS pre-signed URL not implemented yet (Phase 2)")


# Singleton
_cos_client: COSClient | None = None


def get_cos_client() -> COSClient:
    global _cos_client
    if _cos_client is None:
        _cos_client = COSClient()
    return _cos_client
