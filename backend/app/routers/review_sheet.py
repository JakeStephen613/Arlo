"""Review sheet mode — generates end-of-session review from TutorBriefing.

Replaces the old context-based review with learner-model-driven summaries.
"""
from __future__ import annotations

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.llm import call_messages
from app.services.learner_context import get_tutor_briefing

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Models ─────────────────────────────────────────────────────


class ReviewRequest(BaseModel):
    user_id: Optional[str] = None


class ReviewSheet(BaseModel):
    summary: str
    memorization_facts: List[str]
    weak_areas: List[str]
    major_topics: List[str]
    study_tips: List[str]


# ── Helpers ────────────────────────────────────────────────────


def _get_user_id(request: Request, fallback: Optional[str] = None) -> str:
    user = getattr(request.state, "user", {})
    uid = user.get("sub")
    if uid:
        return uid
    if fallback:
        return fallback
    raise HTTPException(status_code=401, detail="Not authenticated")


SYSTEM_PROMPT = """You are a learning coach. Generate a bedtime review sheet for memory consolidation.
Return JSON: {"summary": "2-3 sentences", "memorization_facts": ["3-5 facts"],
"weak_areas": ["2-3 areas"], "major_topics": ["3-4 topics"], "study_tips": ["2-3 tips"]}
Be encouraging, specific, and actionable."""


# ── Endpoint ───────────────────────────────────────────────────


@router.post("/review-sheet", response_model=ReviewSheet)
async def generate_review_sheet(request: Request, data: ReviewRequest):
    user_id = _get_user_id(request, data.user_id)

    try:
        briefing = get_tutor_briefing(user_id)
    except Exception:
        briefing = None

    if briefing and briefing.total_concepts > 0:
        weak = ", ".join(f"{c.name} ({c.mastery:.0%})" for c in briefing.weak_concepts[:5])
        trajectory_lines = "; ".join(
            f"{t.concept_name}: {t.direction}" for t in briefing.trajectory[:5]
        )
        context_text = (
            f"Average mastery: {briefing.average_mastery:.0%}\n"
            f"Weak areas: {weak or 'None'}\n"
            f"Trajectory: {trajectory_lines or 'No data yet'}\n"
            f"Total concepts tracked: {briefing.total_concepts}"
        )
    else:
        context_text = "New student, first session. Provide general study tips."

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Generate a review sheet based on:\n{context_text}"},
    ]

    text = call_messages(messages, response_format={"type": "json_object"}, max_tokens=2000)

    try:
        data_parsed = json.loads(text)
        return ReviewSheet(**data_parsed)
    except Exception as e:
        logger.error("Review sheet parse failed: %s", e)
        return ReviewSheet(
            summary="Great work today! Keep building on your progress.",
            memorization_facts=["Consistent daily review improves retention by 60%"],
            major_topics=["Study session completed"],
            weak_areas=["Track specific topics for detailed feedback"],
            study_tips=["Review these notes again tomorrow morning"],
        )


@router.get("/health")
async def health_check():
    return {"status": "healthy"}
