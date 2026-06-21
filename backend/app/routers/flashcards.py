"""Flashcard mode — generates flashcards, records review attempts.

Consumes TutorBriefing for targeting, calls record_attempt() on review.
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.llm import call_messages
from app.services.learner_context import (
    get_tutor_briefing,
    record_attempt,
    ensure_concept,
    AttemptRecord,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Models ─────────────────────────────────────────────────────


class FlashcardRequest(BaseModel):
    content: str
    format: Optional[str] = "Q&A"
    user_id: Optional[str] = None
    concept_name: Optional[str] = None
    topic: Optional[str] = None


class FlashcardItem(BaseModel):
    id: str
    front: str
    back: str
    difficulty: str
    category: str


class FlashcardReviewRequest(BaseModel):
    card_id: str
    concept_name: str
    topic: Optional[str] = None
    score: float
    user_id: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────


def _get_user_id(request: Request, fallback: Optional[str] = None) -> str:
    user = getattr(request.state, "user", {})
    uid = user.get("sub")
    if uid:
        return uid
    if request.headers.get("x-user-id"):
        return request.headers["x-user-id"]
    if fallback:
        return fallback
    raise HTTPException(status_code=401, detail="Not authenticated")


def _briefing_context(user_id: str) -> str:
    try:
        briefing = get_tutor_briefing(user_id)
        if briefing.weak_concepts:
            weak = ", ".join(c.name for c in briefing.weak_concepts[:3])
            return f"\nStudent's weak areas: {weak}"
    except Exception:
        pass
    return ""


SYSTEM_PROMPT = """You are a flashcard tutor. Create 5-7 flashcards for active recall.
Focus on facts, definitions, and key details that benefit from spaced repetition.
Return JSON: {"flashcards": [{"question": "...", "answer": "..."}]}
Questions should be direct; answers concise but complete with examples in parentheses when helpful."""


# ── Endpoints ──────────────────────────────────────────────────


@router.post("/flashcards")
async def generate_flashcards(request: Request, data: FlashcardRequest):
    user_id = _get_user_id(request, data.user_id)
    ctx = _briefing_context(user_id)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Create flashcards for:\n\n{data.content}{ctx}"},
    ]

    text = call_messages(
        messages,
        response_format={"type": "json_object"},
        max_tokens=4000,
    )

    try:
        parsed = json.loads(text)
        cards_raw = parsed.get("flashcards", [])
    except Exception as e:
        logger.error("Flashcard parse failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to generate flashcards")

    topic = data.topic or "general"
    flashcards = [
        FlashcardItem(
            id=f"card_{uuid.uuid4().hex[:6]}",
            front=c.get("question", ""),
            back=c.get("answer", ""),
            difficulty="medium",
            category=topic,
        )
        for c in cards_raw[:7]
    ]

    return {
        "flashcards": flashcards,
        "total_cards": len(flashcards),
        "estimated_time": f"{len(flashcards) * 2:.0f} minutes",
    }


@router.post("/flashcards/review")
async def review_flashcard(request: Request, data: FlashcardReviewRequest):
    """Record a flashcard review result into the learner model."""
    user_id = _get_user_id(request, data.user_id)
    concept_id = ensure_concept(data.concept_name, data.topic)

    result = record_attempt(AttemptRecord(
        user_id=UUID(user_id),
        concept_id=UUID(concept_id),
        mode="flashcard",
        score=max(0.0, min(1.0, data.score)),
    ))

    return {
        "status": "recorded",
        "new_mastery": result.mastery,
        "next_review": result.next_review.isoformat(),
    }
