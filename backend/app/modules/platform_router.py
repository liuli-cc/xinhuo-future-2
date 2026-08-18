"""Read-only platform catalog and privacy metadata routes."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Query

from ..core.config import get_settings
from ..core.exceptions import NotFoundError
from .auth.dependency import CurrentUser

router = APIRouter(tags=["platform"])


@lru_cache(maxsize=1)
def _mentor_snapshot() -> dict:
    project_root = Path(__file__).resolve().parents[3]
    path = project_root / "frontend" / "data" / "imnu-faculty-snapshot.json"
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _imnu_public_index() -> dict:
    """Read the generated IMNU public-information index.

    The synchronizer deliberately retains only public metadata and the
    official source URL.  Keeping the catalog in the deployable artifact
    makes the static frontend and API return the same attributable records.
    """
    project_root = Path(__file__).resolve().parents[3]
    path = project_root / "frontend" / "data" / "imnu-public-index.json"
    return json.loads(path.read_text(encoding="utf-8"))


@router.get("/mentors")
async def mentors(college: str = "人工智能学院", current_user: CurrentUser = None):
    snapshot = _mentor_snapshot()
    summaries = []
    selected = None
    for item in snapshot.get("colleges", []):
        faculty = item.get("faculty", [])
        summary = {
            "id": item["id"], "school": snapshot.get("school", "内蒙古师范大学"),
            "college": item["name"], "officialUrl": item.get("officialUrl", ""),
            "sourceUrl": item.get("facultySourceUrl", ""), "mentorSourceUrl": item.get("mentorSourceUrl", ""),
            "sourceStatus": item.get("sourceStatus", "no_public_directory"),
            "sourceNote": item.get("sourceNote", ""), "updatedAt": snapshot.get("updatedAt", ""),
            "total": len(faculty),
            "doctoralCount": len([person for person in faculty if person.get("mentorLevel") == "博士研究生导师"]),
            "masterCount": len([person for person in faculty if person.get("mentorLevel") == "硕士研究生导师"]),
        }
        summaries.append(summary)
        if item["name"] == college:
            selected = {**summary, "faculty": faculty}
    if selected is None and summaries:
        selected_item = snapshot["colleges"][0]
        selected = {**summaries[0], "faculty": selected_item.get("faculty", [])}
    if selected is None:
        raise NotFoundError("导师目录为空")
    return {"colleges": summaries, "directory": selected}


@router.get("/imnu/public-content")
async def imnu_public_content(
    section: str | None = Query(None, description="官网公开栏目"),
    search: str | None = Query(None, max_length=120, description="按标题或摘要搜索"),
    limit: int = Query(60, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Return attributable, public IMNU website metadata and source links.

    This endpoint is not a mirror of the official website.  The caller must
    use ``sourceUrl`` to read the complete and current original publication.
    """
    index = _imnu_public_index()
    items = index.get("items", [])
    if section and section != "全部":
        items = [item for item in items if item.get("section") == section]
    if search:
        needle = search.casefold().strip()
        items = [
            item for item in items
            if needle in f"{item.get('title', '')} {item.get('summary', '')}".casefold()
        ]
    return {
        "source": index.get("source", {}),
        "generatedAt": index.get("generatedAt"),
        "sections": index.get("sections", []),
        "crawl": {
            "pagesFetched": index.get("crawl", {}).get("pagesFetched", 0),
            "pageLimit": index.get("crawl", {}).get("pageLimit", 0),
        },
        "total": len(items),
        "limit": limit,
        "offset": offset,
        "data": items[offset:offset + limit],
    }


@router.get("/platform/privacy")
async def privacy_metadata():
    settings = get_settings()
    return {
        "privacyVersion": settings.PRIVACY_VERSION,
        "termsVersion": settings.TERMS_VERSION,
        "deletionGraceDays": settings.ACCOUNT_DELETION_GRACE_DAYS,
        "llmClientKeysAllowed": settings.ALLOW_CLIENT_LLM_KEYS,
        "fileStorage": settings.FILE_STORAGE_BACKEND,
    }
