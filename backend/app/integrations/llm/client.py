"""Server-side OpenAI-compatible LLM gateway with bounded concurrency."""

from __future__ import annotations

import asyncio
import re
import time
from typing import Any

import aiohttp

from ...core.config import get_settings
from ...core.exceptions import LLMServiceError, ValidationError

MODEL_PROVIDERS = {
    "deepseek": {"label": "DeepSeek", "endpoint": "https://api.deepseek.com/chat/completions"},
    "kimi": {"label": "Kimi", "endpoint": "https://api.moonshot.cn/v1/chat/completions"},
    "glm": {"label": "智谱 GLM", "endpoint": "https://open.bigmodel.cn/api/paas/v4/chat/completions"},
    "qwen": {"label": "通义千问", "endpoint": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"},
    "mimo": {"label": "小米 MiMo", "endpoint": "https://api.xiaomimimo.com/v1/chat/completions"},
    "doubao": {"label": "豆包", "endpoint": "https://ark.cn-beijing.volces.com/api/v3/chat/completions"},
}


class LLMClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._semaphore = asyncio.Semaphore(self.settings.LLM_MAX_CONCURRENCY)

    def api_key(self, provider: str, supplied: str = "") -> str:
        if supplied and self.settings.ALLOW_CLIENT_LLM_KEYS:
            return supplied
        if provider == "deepseek":
            return self.settings.DEEPSEEK_API_KEY or self.settings.LLM_API_KEY
        return self.settings.LLM_API_KEY

    @property
    def configured(self) -> bool:
        return bool(self.settings.DEEPSEEK_API_KEY or self.settings.LLM_API_KEY)

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        provider: str | None = None,
        model: str | None = None,
        supplied_key: str = "",
        temperature: float = 0.3,
        max_tokens: int = 900,
    ) -> dict[str, Any]:
        provider = provider or self.settings.LLM_PROVIDER
        if provider not in MODEL_PROVIDERS:
            raise ValidationError("不支持的模型提供商")
        key = self.api_key(provider, supplied_key)
        if not key:
            raise LLMServiceError("服务端尚未配置模型密钥，可使用免费本地流程")
        selected_model = (model or self.settings.LLM_MODEL).strip()
        if not re.fullmatch(r"[A-Za-z0-9._:/-]{1,120}", selected_model):
            raise ValidationError("模型名称格式无效")
        payload = {
            "model": selected_model,
            "messages": messages,
            "temperature": max(0, min(1, temperature)),
            "max_tokens": max(64, min(2000, max_tokens)),
        }
        timeout = aiohttp.ClientTimeout(total=self.settings.LLM_TIMEOUT_SECONDS)
        started = time.perf_counter()
        last_error: Exception | None = None
        async with self._semaphore:
            for attempt in range(3):
                try:
                    async with aiohttp.ClientSession(timeout=timeout) as session:
                        async with session.post(
                            MODEL_PROVIDERS[provider]["endpoint"],
                            json=payload,
                            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                        ) as response:
                            body = await response.json(content_type=None)
                            if response.status >= 500 or response.status == 429:
                                raise LLMServiceError("模型服务繁忙，请稍后重试")
                            if response.status >= 400:
                                raise LLMServiceError("模型请求未通过，请检查服务端模型配置")
                            content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
                            if not content:
                                raise LLMServiceError("模型未返回有效内容")
                            return {
                                "content": content,
                                "provider": provider,
                                "providerLabel": MODEL_PROVIDERS[provider]["label"],
                                "model": payload["model"],
                                "latencyMs": round((time.perf_counter() - started) * 1000),
                                "usage": body.get("usage", {}),
                            }
                except (aiohttp.ClientError, asyncio.TimeoutError, LLMServiceError) as error:
                    last_error = error
                    if attempt < 2:
                        await asyncio.sleep(0.25 * (2 ** attempt))
        if isinstance(last_error, LLMServiceError):
            raise last_error
        raise LLMServiceError("模型网络连接失败")


_client: LLMClient | None = None


def get_llm_client() -> LLMClient:
    global _client
    if _client is None:
        _client = LLMClient()
    return _client
