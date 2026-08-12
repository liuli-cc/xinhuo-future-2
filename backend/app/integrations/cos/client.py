"""Tencent Cloud COS integration used by the storage abstraction."""

from __future__ import annotations

import asyncio

from ...core.config import get_settings


class COSClient:
    """Wraps Tencent COS SDK operations.

    The public interface delegates to the configured storage backend. Local
    storage is used for development and private COS objects for production.
    """

    def __init__(self):
        settings = get_settings()
        self.secret_id = settings.COS_SECRET_ID
        self.secret_key = settings.COS_SECRET_KEY
        self.bucket = settings.COS_BUCKET
        self.region = settings.COS_REGION
        self._configured = bool(self.secret_id and self.secret_key and self.bucket)
        self._client = None
        if self._configured:
            from qcloud_cos import CosConfig, CosS3Client
            self._client = CosS3Client(CosConfig(
                Region=self.region,
                SecretId=self.secret_id,
                SecretKey=self.secret_key,
                Scheme="https",
            ))

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
        """Upload bytes without exposing cloud credentials to the browser."""
        if not self._configured:
            raise RuntimeError(
                "COS upload is not configured. Set COS_SECRET_ID, COS_SECRET_KEY, "
                "and COS_BUCKET environment variables."
            )
        await asyncio.to_thread(
            self._client.put_object,
            Bucket=self.bucket, Body=data, Key=object_key,
            ContentType=mime_type, ServerSideEncryption="AES256",
        )
        return object_key

    async def download(self, object_key: str) -> bytes:
        if not self._configured:
            raise RuntimeError("COS not configured")
        response = await asyncio.to_thread(
            self._client.get_object, Bucket=self.bucket, Key=object_key
        )
        return await asyncio.to_thread(response["Body"].get_raw_stream().read)

    async def delete(self, object_key: str) -> None:
        if not self._configured:
            raise RuntimeError("COS not configured")
        await asyncio.to_thread(self._client.delete_object, Bucket=self.bucket, Key=object_key)

    async def get_presigned_url(self, object_key: str, expires: int = 3600) -> str:
        """Generate a short-lived, read-only download URL."""
        if not self._configured:
            raise RuntimeError("COS not configured")
        return await asyncio.to_thread(
            self._client.get_presigned_url,
            Method="GET", Bucket=self.bucket, Key=object_key, Expired=expires,
        )


# Singleton
_cos_client: COSClient | None = None


def get_cos_client() -> COSClient:
    global _cos_client
    if _cos_client is None:
        _cos_client = COSClient()
    return _cos_client
