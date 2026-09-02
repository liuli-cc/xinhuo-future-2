"""投递状态机 — 岗位投递与公告投递共用的唯一规则模块（ADR-0002）。

两层状态（见 CONTEXT.md「投递阶段 / 结束原因」）：
  stage   七选一：saved → applied → written_test_pending → written_test
                 → interview_pending → interview → offer   （只许前进，允许跳级）
  outcome 二选一：rejected(未通过，需已投递) | withdrawn(已终止，随时可标记)
结束（outcome 非空）即终态，不允许再更新。
"""

from __future__ import annotations

import time

from ...core.exceptions import ConflictError, ValidationError

STAGES: list[str] = [
    "saved", "applied", "written_test_pending", "written_test",
    "interview_pending", "interview", "offer",
]
STAGE_LABELS: dict[str, str] = {
    "saved": "待投递",
    "applied": "已投递",
    "written_test_pending": "待笔试",
    "written_test": "已笔试",
    "interview_pending": "待面试",
    "interview": "已面试",
    "offer": "已Offer",
}
OUTCOMES: list[str] = ["rejected", "withdrawn"]
OUTCOME_LABELS: dict[str, str] = {
    "rejected": "未通过",
    "withdrawn": "已终止",
}
_STAGE_INDEX = {stage: index for index, stage in enumerate(STAGES)}


def validate_target(stage: str, outcome: str | None, next_stage: str | None, next_outcome: str | None) -> tuple[str, str | None]:
    """Return the (stage, outcome) the application should move to, or raise."""
    if outcome:
        raise ConflictError("该投递已结束，不能再更新进度")
    next_stage = (next_stage or "").strip() or None
    next_outcome = (next_outcome or "").strip() or None

    if next_outcome:
        if next_outcome not in OUTCOMES:
            raise ValidationError("结束原因无效")
        if next_outcome == "rejected" and stage == "saved":
            raise ConflictError("尚未投递，无法标记为未通过；如放弃可使用已终止")
        if next_stage and next_stage not in STAGES:
            raise ValidationError("投递阶段无效")
        return (next_stage or stage), next_outcome

    if not next_stage:
        raise ValidationError("请选择要更新到的阶段")
    if next_stage not in STAGES:
        raise ValidationError("投递阶段无效")
    if _STAGE_INDEX[next_stage] < _STAGE_INDEX[stage]:
        raise ConflictError("投递阶段不能回退")
    return next_stage, None


def now_ms() -> int:
    return int(time.time() * 1000)


def apply_transition(item, next_stage: str, next_outcome: str | None, note: str) -> dict:
    """Mutate an application-like object (岗位投递或公告投递均可) and return event payload.

    The caller is responsible for persisting the event row with the returned dict.
    """
    now = now_ms()
    leaving_saved = item.stage == "saved" and next_stage != "saved"
    item.stage = next_stage
    item.outcome = next_outcome
    item.note = note[:5000]
    item.last_event_at = now
    if leaving_saved and not item.submitted_at:
        item.submitted_at = now
    if next_outcome and not item.closed_at:
        item.closed_at = now
    # 时间线上，结束事件记录结束原因，其余记录进入的阶段
    return {"stage": next_outcome or next_stage, "note": note[:5000]}
