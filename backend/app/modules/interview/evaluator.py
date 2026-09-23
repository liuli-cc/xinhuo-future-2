"""Bounded voice measurements and evidence-anchored model evaluation."""
from __future__ import annotations

import asyncio
import math
import re
from functools import lru_cache
from pathlib import Path

DIMENSION_MAXIMA = {"content": 30, "roleMatch": 20, "professionalDepth": 20, "logicStructure": 15, "languageExpression": 15}
FILLERS = re.compile(r"嗯+|呃+|(?:^|[，。！？；,!?;\s])(怎么说呢|就是说|那个|就是|啊+)(?=[，。！？；,!?;\s]|$)")


def number(value, maximum=1_800_000, minimum=0):
    try:
        result = float(value)
        return max(minimum, min(maximum, result)) if math.isfinite(result) else minimum
    except (ValueError, TypeError):
        return minimum


def speech_measurements(payload: dict) -> dict:
    text = str(payload.get("transcript", ""))[:20_000]
    duration = number(payload.get("totalDurationMs"), minimum=1)
    capture = payload.get("captureStats") or {}
    if not isinstance(capture, dict):
        capture = {}
    effective = number(capture.get("activeSpeechMs"), maximum=duration)
    pauses = [number(value, maximum=duration) for value in (capture.get("pauseDurationsMs") or [])[:200] if isinstance(value, (int, float))]
    volumes = [number(value, maximum=100) for value in (capture.get("volumeSamples") or [])[:60_000] if isinstance(value, (int, float))]
    counts = {}
    for match in FILLERS.finditer(text):
        token = match.group(1) or match.group()
        counts[token] = counts.get(token, 0) + 1
    average = sum(volumes) / len(volumes) if volumes else 0
    star_patterns = [r"当时|背景|情境|期间|之前|原本", r"目标|任务|负责|需要|要求|期望", r"我先|我负责|我采用|我通过|具体做法|随后|接着|然后我|于是我|所以我", r"最终|结果|提升|降低|完成|获得|达成|产出|交付"]
    return {
        "wordsPerMinute": round(len(re.sub(r"[\W_]", "", text)) / max(1000, effective) * 60000),
        "effectiveSpeechSeconds": round(effective / 1000), "totalAnswerSeconds": round(duration / 1000),
        "pauseCount": len(pauses), "pauseRatio": round(min(duration, sum(pauses)) / duration * 100),
        "thinkingBeforeAnswerMs": round(number(capture.get("thinkingBeforeAnswerMs"), maximum=duration)),
        "fillerWordCounts": counts, "fillerWordsPerMinute": round(sum(counts.values()) / duration * 60000, 1),
        "repeatedPhrases": re.findall(r"(.{2,10})\1{2,}", text)[:5],
        "averageVolume": round(average), "volumeVariance": round(sum((value - average) ** 2 for value in volumes) / len(volumes)) if volumes else 0,
        "isOvertime": duration > 180000, "starCompleteness": sum(bool(re.search(pattern, text)) for pattern in star_patterns),
        "measurementSource": "browser-energy-estimate", "fillerSource": "transcript-only",
    }


@lru_cache(maxsize=1)
def interview_skill() -> str:
    return (Path(__file__).parent / "skills" / "interview-coach.md").read_text(encoding="utf-8")


def sanitize_analysis(value, answer: str) -> dict:
    value = value if isinstance(value, dict) else {}
    def clean_list(key):
        rows = value.get(key)
        return [str(item)[:200] for item in rows[:4] if isinstance(item, str)] if isinstance(rows, list) else []
    evidence = [quote for quote in clean_list("evidence") if 2 <= len(quote) <= 100 and quote in answer]
    dimensions = {}
    candidates = value.get("dimensions")
    if isinstance(candidates, dict):
        for key, maximum in DIMENSION_MAXIMA.items():
            item = candidates.get(key)
            if not isinstance(item, dict):
                continue
            quote = str(item.get("quote", ""))[:100]
            if len(quote) < 2 or quote not in answer:
                continue
            dimensions[key] = {"score": round(number(item.get("score"), maximum=maximum)), "quote": quote, "reason": str(item.get("reason", ""))[:240]}
    return {"summary": str(value.get("summary", ""))[:300], "strengths": clean_list("strengths"), "gaps": clean_list("gaps"), "evidence": evidence, "nextFocus": str(value.get("nextFocus", ""))[:200], "dimensions": dimensions, "skillVersion": "XH-INTERVIEW-2"}


async def while_connected(request, operation):
    """Close the provider socket when the browser cancels its answer request."""
    task = asyncio.create_task(operation)
    try:
        while not task.done():
            if await request.is_disconnected():
                raise asyncio.CancelledError()
            await asyncio.wait({task}, timeout=0.15)
        return await task
    finally:
        if not task.done():
            task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass
