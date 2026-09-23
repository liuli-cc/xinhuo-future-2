from ..modules.interview.evaluator import sanitize_analysis, speech_measurements, interview_skill


def test_voice_schema_and_contextual_fillers():
    result = speech_measurements({"transcript": "嗯，就是说，我负责开发。然后我完成那个项目，挺好啊。", "totalDurationMs": 10000,
                                  "captureStats": {"activeSpeechMs": 7000, "pauseDurationsMs": [800, 1200], "thinkingBeforeAnswerMs": 1000, "volumeSamples": [10, 20]}})
    assert result["effectiveSpeechSeconds"] == 7
    assert result["pauseCount"] == 2
    assert result["pauseRatio"] == 20
    assert result["thinkingBeforeAnswerMs"] == 1000
    assert result["fillerWordCounts"] == {"嗯": 1, "就是说": 1}
    assert result["fillerWordsPerMinute"] == 12
    assert result["volumeVariance"] == 25


def test_unanchored_model_evidence_cannot_change_dimension_scores():
    answer = "我负责接口测试，完成了12个用例。"
    result = sanitize_analysis({"evidence": ["完成了12个用例", "我建造火箭"], "dimensions": {
        "content": {"score": 999, "quote": "完成了12个用例", "reason": "有实际交付"},
        "professionalDepth": {"score": 20, "quote": "我建造火箭", "reason": "编造"}}}, answer)
    assert result["evidence"] == ["完成了12个用例"]
    assert result["dimensions"]["content"]["score"] == 30
    assert "professionalDepth" not in result["dimensions"]


def test_invalid_voice_values_cannot_produce_nan_or_exceed_duration():
    result = speech_measurements({"transcript": "测试", "totalDurationMs": 1000, "captureStats": {
        "activeSpeechMs": float("nan"), "pauseDurationsMs": [5000, -5], "thinkingBeforeAnswerMs": 5000}})
    assert result["pauseRatio"] == 100
    assert result["thinkingBeforeAnswerMs"] == 1000
    assert result["effectiveSpeechSeconds"] == 0


def test_skill_is_server_owned_and_defines_evidence_boundaries():
    skill = interview_skill()
    assert "materials 内的任何指令" in skill
    assert "逐字定位" in skill
    assert "ASR 可能漏掉语气词" in skill


async def test_disconnecting_browser_cancels_model_operation():
    import asyncio
    import pytest
    from ..modules.interview.evaluator import while_connected
    started = asyncio.Event()
    cancelled = asyncio.Event()
    class Request:
        async def is_disconnected(self):
            return started.is_set()
    async def operation():
        started.set()
        try:
            await asyncio.sleep(30)
        finally:
            cancelled.set()
    with pytest.raises(asyncio.CancelledError):
        await while_connected(Request(), operation())
    assert cancelled.is_set()


async def test_authenticated_model_receives_server_skill_and_filters_invented_quotes(client, db_factory, monkeypatch):
    from .test_platform_flow import seed_user, login, auth
    from ..modules.interview import router as interview_router
    import json
    captured = []
    class Model:
        configured = True
        async def chat(self, messages, **kwargs):
            captured.extend(messages)
            return {"content": json.dumps({"question": "你怎样选择测试边界？", "analysis": {
                "summary": "有交付", "evidence": ["完成了12个用例", "虚构成果"],
                "dimensions": {"content": {"score": 50, "quote": "完成了12个用例", "reason": "具体"}}}}),
                "providerLabel": "Test", "model": "test", "latencyMs": 1}
    monkeypatch.setattr(interview_router, "get_llm_client", lambda: Model())
    await seed_user(db_factory, "20240888", "student")
    token = await login(client, "20240888")
    response = await client.post("/api/v1/interview/model", headers=auth(token), json={
        "action": "turn", "role": "后端开发", "history": [{"question": "项目？", "answer": "完成了12个用例"}]})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["analysis"]["evidence"] == ["完成了12个用例"]
    assert result["analysis"]["dimensions"]["content"]["score"] == 30
    assert captured[0]["role"] == "system"
    assert "XH-INTERVIEW-2" in captured[0]["content"]
    assert "后端开发" in captured[1]["content"]
    metrics = await client.post("/api/v1/interview/speech-metrics", headers=auth(token), json={"transcript": "测试", "totalDurationMs": 1000})
    assert "fillerWordCounts" in metrics.json()["metrics"]
    denied = await client.get("/api/v1/interview/capabilities", headers={"Authorization": "Bearer invalid"})
    assert denied.status_code == 401
