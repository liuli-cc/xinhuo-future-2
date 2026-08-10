"""
LLM integration stub.

Phase 1: stub with provider definitions matching the existing
         CloudBase backend's MODEL_PROVIDERS configuration.

Phase 2: full implementation with httpx/aiohttp proxy calls.
"""

from __future__ import annotations

MODEL_PROVIDERS = {
    "deepseek": {
        "label": "DeepSeek",
        "endpoint": "https://api.deepseek.com/chat/completions",
    },
    "kimi": {
        "label": "Kimi",
        "endpoint": "https://api.moonshot.cn/v1/chat/completions",
    },
    "glm": {
        "label": "智谱 GLM",
        "endpoint": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    },
    "qwen": {
        "label": "通义千问",
        "endpoint": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    },
    "mimo": {
        "label": "小米 MiMo",
        "endpoint": "https://api.xiaomimimo.com/v1/chat/completions",
    },
    "doubao": {
        "label": "豆包",
        "endpoint": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    },
}
