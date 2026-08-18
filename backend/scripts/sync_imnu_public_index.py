#!/usr/bin/env python3
"""Build a conservative index of public information on www.imnu.edu.cn.

The index intentionally stores only navigational metadata: title, category,
date-like labels, canonical source URL and sync time.  It does not download
attachments, images, login-only systems, or article bodies.  This keeps the
platform attributable to the official source and lets readers open the
original page for the authoritative full text.

Usage:
    python backend/scripts/sync_imnu_public_index.py --max-pages 60

The output is consumed by the statically exported frontend, so run this
before a frontend build whenever the catalogue needs refreshing.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlsplit, urlunsplit

import requests


HOME_URL = "https://www.imnu.edu.cn/"
ALLOWED_HOST = "www.imnu.edu.cn"
USER_AGENT = "XinhuoFuturePublicIndex/0.7 (+https://github.com/liuli-cc/xinhuo-future-2)"
OUTPUT_PATH = Path(__file__).resolve().parents[2] / "frontend" / "data" / "imnu-public-index.json"
MAX_SUMMARY_LENGTH = 240
IGNORED_LINK_LABELS = {"首页", "上页", "下页", "尾页", "上一页", "下一页", "详细", "详情"}


@dataclass(frozen=True)
class Link:
    href: str
    text: str
    css_class: str


class PageParser(HTMLParser):
    """Extract links and the small amount of metadata safe for an index."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[Link] = []
        self.title_parts: list[str] = []
        self.description = ""
        self._inside_title = False
        self._anchor: dict[str, str] | None = None
        self._anchor_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): value or "" for key, value in attrs}
        if tag == "title":
            self._inside_title = True
        elif tag == "meta" and values.get("name", "").lower() in {"description", "og:description"}:
            self.description = self.description or values.get("content", "")
        elif tag == "a" and values.get("href"):
            self._anchor = values
            self._anchor_parts = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._inside_title = False
        elif tag == "a" and self._anchor is not None:
            text = _clean_text("".join(self._anchor_parts))
            if text:
                self.links.append(Link(self._anchor["href"], text, self._anchor.get("class", "")))
            self._anchor = None
            self._anchor_parts = []

    def handle_data(self, data: str) -> None:
        if self._inside_title:
            self.title_parts.append(data)
        if self._anchor is not None:
            self._anchor_parts.append(data)

    @property
    def title(self) -> str:
        return _clean_text("".join(self.title_parts))


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _canonical(url: str, base_url: str) -> str | None:
    absolute = urljoin(base_url, url)
    parsed = urlsplit(absolute)
    if parsed.scheme not in {"http", "https"} or parsed.hostname != ALLOWED_HOST:
        return None
    if parsed.path.startswith("/system/_content/download.jsp"):
        return None
    if re.search(r"/(?:xsyj|shfw|whns/xb1)/\d+\.htm$", parsed.path):
        return None
    # Fragments are navigation within a page and do not identify a standalone item.
    return urlunsplit(("https", ALLOWED_HOST, parsed.path or "/", parsed.query, ""))


def _section(url: str, title: str, css_class: str = "") -> str:
    path = urlsplit(url).path
    label = f"{title} {css_class}"
    if "/info/1311/" in path or any(word in label for word in ("通知", "公告", "校历", "电话")):
        return "通知与服务"
    if "/info/1301/" in path or "新闻" in label:
        return "校园新闻"
    if "/info/1281/" in path or "学术" in label or "科研" in label:
        return "学术科研"
    if "/xxgk/" in path or "学校概况" in label or "领导" in label:
        return "学校概况"
    if path.endswith("zzjg.htm") or "学院" in label or "机构" in label:
        return "组织机构"
    if any(token in path for token in ("xsyj", "nsrm", "shfw", "whns")):
        return "学校公开栏目"
    return "官网公开链接"


def _date_label(value: str) -> str | None:
    matched = re.search(r"20\d{2}[-./]\d{1,2}(?:[-./]\d{1,2})?", value)
    return matched.group(0) if matched else None


def _id_for(url: str) -> str:
    return "imnu-" + hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]


def _fetch(session: requests.Session, url: str) -> PageParser | None:
    response = session.get(url, timeout=20, allow_redirects=True)
    response.raise_for_status()
    if "text/html" not in response.headers.get("content-type", ""):
        return None
    # The website does not consistently declare a response charset.  Requests
    # otherwise defaults to ISO-8859-1 and corrupts Chinese page titles.
    encoding = response.apparent_encoding or response.encoding or "utf-8"
    parser = PageParser()
    parser.feed(response.content.decode(encoding, errors="replace"))
    return parser


def _page_item(url: str, parser: PageParser, synced_at: str) -> dict | None:
    title = re.sub(r"\s*[-—_｜|]\s*内蒙古师范大学.*$", "", parser.title).strip()
    if not title or re.fullmatch(r"\d+", title) or url == HOME_URL:
        return None
    summary = _clean_text(parser.description)[:MAX_SUMMARY_LENGTH]
    return {
        "id": _id_for(url),
        "title": title,
        "section": _section(url, title),
        "publishedAt": _date_label(title),
        "summary": summary,
        "sourceUrl": url,
        "sourceHost": ALLOWED_HOST,
        "syncedAt": synced_at,
    }


def build_index(max_pages: int, delay: float) -> dict:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    queue = [HOME_URL]
    visited: set[str] = set()
    items: dict[str, dict] = {}
    synced_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    failures: list[dict[str, str]] = []

    while queue and len(visited) < max_pages:
        url = queue.pop(0)
        if url in visited:
            continue
        try:
            parser = _fetch(session, url)
        except requests.RequestException as error:
            failures.append({"url": url, "error": str(error)[:160]})
            visited.add(url)
            continue
        visited.add(url)
        if parser is None:
            continue

        page = _page_item(url, parser, synced_at)
        if page:
            items[page["sourceUrl"]] = page

        for link in parser.links:
            candidate = _canonical(link.href, url)
            if not candidate:
                continue
            # Link labels on list pages are valuable even if crawling reaches its cap.
            if link.text and link.text not in IGNORED_LINK_LABELS and not re.fullmatch(r"\d+", link.text) and candidate != HOME_URL:
                items.setdefault(candidate, {
                    "id": _id_for(candidate),
                    "title": link.text,
                    "section": _section(candidate, link.text, link.css_class),
                    "publishedAt": _date_label(link.text),
                    "summary": "",
                    "sourceUrl": candidate,
                    "sourceHost": ALLOWED_HOST,
                    "syncedAt": synced_at,
                })
            if candidate not in visited and candidate not in queue:
                queue.append(candidate)

        if queue and delay:
            time.sleep(delay)

    ordered = sorted(items.values(), key=lambda item: (item["section"], item["title"]))
    sections = sorted({item["section"] for item in ordered})
    return {
        "schemaVersion": 1,
        "source": {
            "name": "内蒙古师范大学官网",
            "homeUrl": HOME_URL,
            "scope": "仅索引 www.imnu.edu.cn 的公开 HTML 页面元数据；不复制正文、图片、附件，不抓取登录系统或外部子站。",
            "copyrightNotice": "原文版权归内蒙古师范大学及原始发布方所有，平台仅提供索引与跳转。",
        },
        "generatedAt": synced_at,
        "crawl": {"pagesFetched": len(visited), "pageLimit": max_pages, "failures": failures},
        "sections": sections,
        "items": ordered,
    }


def write_index(index: dict, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="同步内蒙古师范大学官网公开信息索引")
    parser.add_argument("--max-pages", type=int, default=60, choices=range(1, 501), metavar="1..500")
    parser.add_argument("--delay", type=float, default=0.7, help="每次请求间隔秒数，最小为 0.5")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args()
    index = build_index(max_pages=args.max_pages, delay=max(0.5, args.delay))
    write_index(index, args.output)
    print(json.dumps({"output": str(args.output), "items": len(index["items"]), "pagesFetched": index["crawl"]["pagesFetched"], "failures": len(index["crawl"]["failures"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
