"""Orchestrator API — adaptive session management.

Exposes the orchestrator's create/step/submit cycle as REST endpoints
so the frontend can run adaptive sessions driven by the learner model.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import logging

from app.services.orchestrator import (
    SessionIntent,
    SessionPlan,
    SessionStep,
    SessionSummary,
    NextStepResponse,
    create_session,
    get_current_step,
    submit_step,
    get_session_plan,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_user_id(request: Request) -> str:
    user = getattr(request.state, "user", {})
    uid = user.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


class CreateSessionRequest(BaseModel):
    intent: str = "deep_session"
    topic: Optional[str] = None


class SubmitStepRequest(BaseModel):
    score: float
    confidence_before: Optional[float] = None


@router.post("/orchestrator/session")
async def create_adaptive_session(request: Request, data: CreateSessionRequest):
    user_id = _get_user_id(request)
    try:
        intent = SessionIntent(data.intent)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid intent: {data.intent}")
    try:
        plan = create_session(user_id, intent, data.topic)
        current = get_current_step(str(plan.session_id))
        return {
            "session_id": str(plan.session_id),
            "intent": plan.intent.value,
            "total_steps": len(plan.steps),
            "steps": [_step_dict(s) for s in plan.steps],
            "current_step": _step_response_dict(current),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to create adaptive session")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orchestrator/session/{session_id}/step")
async def get_step(request: Request, session_id: str):
    _get_user_id(request)
    result = get_current_step(session_id)
    return _step_response_dict(result)


@router.post("/orchestrator/session/{session_id}/submit")
async def submit(request: Request, session_id: str, data: SubmitStepRequest):
    _get_user_id(request)
    result = submit_step(session_id, data.score, data.confidence_before)
    plan = get_session_plan(session_id)
    return {
        **_step_response_dict(result),
        "steps": [_step_dict(s) for s in plan.steps] if plan else [],
        "total_steps": len(plan.steps) if plan else 0,
    }


@router.get("/orchestrator/session/{session_id}")
async def get_plan(request: Request, session_id: str):
    _get_user_id(request)
    plan = get_session_plan(session_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": str(plan.session_id),
        "intent": plan.intent.value,
        "total_steps": len(plan.steps),
        "current_step": plan.current_step,
        "steps": [_step_dict(s) for s in plan.steps],
    }


def _step_dict(s: SessionStep) -> dict:
    return {
        "step_number": s.step_number,
        "mode": s.mode.value,
        "concept_id": str(s.concept_id),
        "concept_name": s.concept_name,
        "difficulty": s.difficulty,
        "rationale": s.rationale,
        "completed": s.completed,
        "score": s.score,
    }


def _step_response_dict(r: NextStepResponse) -> dict:
    result: dict = {"done": r.done}
    if r.step:
        result["step"] = _step_dict(r.step)
    if r.summary:
        result["summary"] = {
            "session_id": str(r.summary.session_id),
            "intent": r.summary.intent.value,
            "total_steps": r.summary.total_steps,
            "completed_steps": r.summary.completed_steps,
            "concepts_practiced": r.summary.concepts_practiced,
            "improved": r.summary.improved,
            "still_weak": r.summary.still_weak,
            "scheduled_next": r.summary.scheduled_next,
            "average_score": r.summary.average_score,
        }
    return result
