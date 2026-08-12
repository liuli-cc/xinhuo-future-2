"""Durable file-storage abstraction with local and Tencent COS backends."""

from __future__ import annotations

import asyncio
from pathlib import Path

from ..core.config import get_settings
from ..core.exceptions import COSError
from .cos.client import get_cos_client


class StorageClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.backend = self.settings.FILE_STORAGE_BACKEND.lower()
        self.root = self.settings.local_storage_path

    def _local_path(self, object_key: str) -> Path:
        target = (self.root / object_key).resolve()
        if target != self.root and self.root not in target.parents:
            raise COSError("文件路径校验失败")
        return target

    async def upload(self, object_key: str, data: bytes, mime_type: str) -> None:
        if self.backend == "cos":
            await get_cos_client().upload(object_key, data, mime_type)
            return
        if self.backend != "local":
            raise COSError("未知的文件存储后端")
        target = self._local_path(object_key)

        def write() -> None:
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_suffix(target.suffix + ".uploading")
            temporary.write_bytes(data)
            temporary.replace(target)

        await asyncio.to_thread(write)

    async def read(self, object_key: str) -> bytes:
        if self.backend == "cos":
            return await get_cos_client().download(object_key)
        target = self._local_path(object_key)
        if not target.is_file():
            raise COSError("文件内容不存在")
        return await asyncio.to_thread(target.read_bytes)

    async def delete(self, object_key: str) -> None:
        if self.backend == "cos":
            await get_cos_client().delete(object_key)
            return
        target = self._local_path(object_key)
        if target.exists():
            await asyncio.to_thread(target.unlink)

    async def presigned_url(self, object_key: str, expires: int = 900) -> str | None:
        if self.backend != "cos":
            return None
        return await get_cos_client().get_presigned_url(object_key, expires)


_storage_client: StorageClient | None = None


def get_storage_client() -> StorageClient:
    global _storage_client
    if _storage_client is None:
        _storage_client = StorageClient()
    return _storage_client
