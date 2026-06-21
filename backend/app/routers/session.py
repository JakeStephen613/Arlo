from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import logging

from app.services.learner_context import get_tutor_briefing, TutorBriefing
from app.services.orchestrator import (
    SessionIntent,
    SessionPlan,
    NextStepResponse,
    create_session,
    get_current_step,
    get_session_plan,
    submit_step,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_user_id(request: Request) -> str:
    if request.headers.get("x-user-id"):
        return request.headers["x-user-id"]
    user = getattr(request.state, "user", {})
    uid = user.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


# ── Briefing ────────────────────────────────────────────────────


@router.get("/learner/briefing", response_model=TutorBriefing)
async def briefing(request: Request):
    user_id = _get_user_id(request)
    return get_tutor_briefing(user_id)


# ── Session lifecycle ───────────────────────────────────────────


class CreateSessionRequest(BaseModel):
    intent: SessionIntent
    topic: Optional[str] = None


@router.post("/session/create", response_model=SessionPlan)
async def create(request: Request, body: CreateSessionRequest):
    user_id = _get_user_id(request)
    plan = create_session(user_id, body.intent, body.topic)
    return plan


@router.get("/session/{session_id}", response_model=SessionPlan)
async def get_plan(session_id: str):
    plan = get_session_plan(session_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Session not found")
    return plan


@router.get("/session/{session_id}/next", response_model=NextStepResponse)
async def next_step(session_id: str):
    return get_current_step(session_id)


class SubmitStepRequest(BaseModel):
    score: float
    confidence_before: Optional[float] = None


@router.post("/session/{session_id}/submit", response_model=NextStepResponse)
async def submit(session_id: str, body: SubmitStepRequest):
    return submit_step(session_id, body.score, body.confidence_before)
