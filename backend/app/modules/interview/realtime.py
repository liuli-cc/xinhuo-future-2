"""Authenticated Realtime WebRTC negotiation. No provider credentials reach a browser."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import re
import time
from collections import defaultdict, deque

import aiohttp
from fastapi import APIRouter, Body, Request

from ...core.config import get_settings
from ...core.exceptions import ForbiddenError, LLMServiceError, RateLimitError, ValidationError
from ..auth.dependency import CurrentUser
from .evaluator import interview_skill, while_connected

router = APIRouter(prefix="/realtime")
STARTS: dict[str, deque] = defaultdict(deque)
WATCHDOGS: dict[str, asyncio.Task] = {}
OPENAI_CALLS = "https://api.openai.com/v1/realtime/calls"


def realtime_session_config(payload: dict, settings) -> dict:
    # Keep the shared behavioral/evidence policy, use spoken output instead of JSON.
    skill = interview_skill().split("## 输出")[0]
    context = {"role": str(payload.get("role", "通用能力"))[:100], "job": payload.get("job") or {},
               "resume": payload.get("resume") or {}, "opening": str(payload.get("opening", ""))[:500]}
    instructions = (skill + "\n## 实时语音模式\n直接用自然中文口语交谈，不朗读 JSON、不宣布分数。"
                    "每次最多两句话，一次只问一件事。学生打断时立即停止，听完补充再接话。"
                    "自然思考和语气助词不代表能力不足。对方还在组织语言时不要连续追问。"
                    "先简短自我介绍，然后提出材料中的 opening 问题。\n<materials>"
                    + json.dumps(context, ensure_ascii=False)[:14000] + "</materials>")
    vad = {"type": "semantic_vad", "eagerness": "medium", "create_response": True, "interrupt_response": True}
    if settings.REALTIME_VAD_MODE == "server_vad":
        vad = {"type": "server_vad", "threshold": 0.5, "prefix_padding_ms": 300,
               "silence_duration_ms": 900, "create_response": True, "interrupt_response": True}
    return {"type": "realtime", "model": settings.REALTIME_MODEL, "instructions": instructions,
            "output_modalities": ["audio"], "max_output_tokens": 420,
            "audio": {"input": {"noise_reduction": {"type": "near_field"},
                                 "transcription": {"model": "gpt-4o-mini-transcribe", "language": "zh", "prompt": "大学生中文面试；保留实际说出的嗯、呃及自我修正。"},
                                 "turn_detection": vad}, "output": {"voice": settings.REALTIME_VOICE}}}


def sign_call(call_id: str, user_id: str, settings) -> str:
    raw = json.dumps({"call": call_id, "user": user_id, "exp": int(time.time()) + 3600}, separators=(",", ":")).encode()
    encoded = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    signature = hmac.new(settings.SECRET_KEY.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return encoded + "." + signature


def verify_call(token: str, user_id: str, settings) -> str:
    try:
        encoded, signature = token.split(".")
        expected = hmac.new(settings.SECRET_KEY.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError()
        data = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        call = str(data["call"])
        if data["user"] != user_id or data["exp"] < time.time() or not re.fullmatch(r"[A-Za-z0-9_-]{1,180}", call):
            raise ValueError()
        return call
    except (ValueError, KeyError, TypeError):
        raise ForbiddenError("通话凭据无效")


async def negotiate_call(sdp: str, config: dict, user_id: str, settings) -> tuple[str, str]:
    form = aiohttp.FormData()
    form.add_field("sdp", sdp, content_type="application/sdp")
    form.add_field("session", json.dumps(config, ensure_ascii=False), content_type="application/json")
    call_id = ""
    accepted = False
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=25)) as session:
            async with session.post(OPENAI_CALLS, data=form, headers={
                "Authorization": f"Bearer {settings.OPENAI_REALTIME_API_KEY}",
                "OpenAI-Safety-Identifier": hashlib.sha256(user_id.encode()).hexdigest(),
            }) as response:
                if response.status not in (200, 201):
                    # Provider response bodies may contain sensitive request details.
                    raise LLMServiceError("实时语音连接未建立，请检查服务端模型权限、额度和网络")
                location_id = response.headers.get("Location", "").rstrip("/").split("/")[-1]
                if not re.fullmatch(r"[A-Za-z0-9_-]{1,180}", location_id):
                    raise LLMServiceError("实时语音未返回有效通话凭据")
                call_id = location_id
                register_watchdog(call_id, settings)
                answer = await response.text()
                if not answer.startswith("v=0") or len(answer) > 100_000:
                    raise LLMServiceError("实时语音协商返回无效")
                accepted = True
                return answer, call_id
    except (aiohttp.ClientError, asyncio.TimeoutError) as error:
        raise LLMServiceError("实时语音网络连接失败") from error
    finally:
        if call_id and not accepted:
            # The provider may have allocated the call before a browser abort.
            task = asyncio.create_task(safe_hangup(call_id, settings))
            task.add_done_callback(lambda _: None)


async def safe_hangup(call_id: str, settings):
    try:
        await hangup_call(call_id, settings)
    except LLMServiceError:
        pass


def register_watchdog(call_id: str, settings):
    if call_id in WATCHDOGS:
        return
    task = asyncio.create_task(expire_call(call_id, settings))
    WATCHDOGS[call_id] = task
    task.add_done_callback(lambda completed: WATCHDOGS.pop(call_id, None) if WATCHDOGS.get(call_id) is completed else None)


async def hangup_call(call_id: str, settings):
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            async with session.post(f"{OPENAI_CALLS}/{call_id}/hangup", headers={"Authorization": f"Bearer {settings.OPENAI_REALTIME_API_KEY}"}) as response:
                if response.status not in (200, 204, 404):
                    raise LLMServiceError("服务端结束通话未确认")
    except (aiohttp.ClientError, asyncio.TimeoutError) as error:
        raise LLMServiceError("服务端结束通话未确认") from error


async def expire_call(call_id: str, settings):
    await asyncio.sleep(max(60, min(900, settings.REALTIME_MAX_SECONDS)))
    try:
        await hangup_call(call_id, settings)
    except LLMServiceError:
        pass  # Client independently closes the peer and media at the same deadline.


@router.post("/session")
async def create_realtime_session(request: Request, current_user: CurrentUser, payload: dict = Body(...)):
    settings = get_settings()
    if not settings.OPENAI_REALTIME_API_KEY:
        raise LLMServiceError("实时语音尚未配置")
    if payload.get("consent") is not True:
        raise ValidationError("请先同意实时语音数据传输")
    sdp = payload.get("sdp")
    if not isinstance(sdp, str) or not sdp.startswith("v=0") or not 1 < len(sdp) <= 65536:
        raise ValidationError("实时语音协商参数无效")
    user_id = str(current_user["id"])
    bucket = STARTS[user_id]
    while bucket and bucket[0] < time.monotonic() - 60:
        bucket.popleft()
    if len(bucket) >= 3:
        raise RateLimitError("请稍后再开始新的实时通话")
    bucket.append(time.monotonic())
    answer, call_id = await while_connected(request, negotiate_call(sdp, realtime_session_config(payload, settings), user_id, settings))
    register_watchdog(call_id, settings)
    return {"sdp": answer, "callToken": sign_call(call_id, user_id, settings), "model": settings.REALTIME_MODEL,
            "maxSeconds": max(60, min(900, settings.REALTIME_MAX_SECONDS)),
            "turnDetection": realtime_session_config(payload, settings)["audio"]["input"]["turn_detection"]}


@router.post("/hangup")
async def end_realtime_session(current_user: CurrentUser, payload: dict = Body(...)):
    settings = get_settings()
    call_id = verify_call(str(payload.get("callToken", ""))[:2000], str(current_user["id"]), settings)
    await hangup_call(call_id, settings)
    return {"closed": True}
