"""Blurting mode — generates recall exercises, grades via Haiku rubric.

Consumes TutorBriefing, grades blurted responses 0-1, calls record_attempt().
"""
from __future__ import annotations

import json
import logging
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


class ExerciseItem(BaseModel):
    prompt: str
    focus: str


class BlurtingExerciseRequest(BaseModel):
    teaching_block: str
    user_id: Optional[str] = None
    concept_name: Optional[str] = None
    topic: Optional[str] = None


class BlurtingExerciseResponse(BaseModel):
    exercise_1: ExerciseItem
    exercise_2: ExerciseItem
    exercise_3: ExerciseItem


class BlurtingFeedbackRequest(BaseModel):
    exercise_question: str
    blurted_response: str
    user_id: Optional[str] = None
    concept_name: Optional[str] = None
    topic: Optional[str] = None


class BlurtingFeedbackResponse(BaseModel):
    mentioned: List[str]
    partial_mentions: List[str]
    missed: List[str]
    mentioned_count: int
    total_key_concepts: int
    score_fraction: str
    score: float
    feedback: str


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


EXERCISE_SYSTEM = """Design 3 blurting exercises based on the teaching content provided. Blurting is a recall technique: the student writes down everything they remember about a prompt WITHOUT looking at notes.

Each exercise should target a different cognitive level:
1. Factual recall: "Write down everything you remember about [specific topic/definition/details]."
2. Process/sequence recall: "Describe the steps of [process] from memory." or "Explain the cause-and-effect chain of [phenomenon]."
3. Conceptual synthesis: "Compare and contrast [X] and [Y] from memory." or "Explain how [concept A] relates to [concept B]."

Make prompts specific to the teaching content — reference actual concepts, terms, and processes that were taught. Do NOT use generic prompts like "recall key concepts."

Return JSON: {"exercises": [{"prompt": "...", "focus": "..."}, {"prompt": "...", "focus": "..."}, {"prompt": "...", "focus": "..."}]}"""

FEEDBACK_SYSTEM = """Evaluate a student's blurting (free recall) response. Your job is to identify what key concepts they remembered, partially remembered, or missed entirely.

EVALUATION PROCESS:
1. List 5-8 key concepts that a complete answer should include (based on the question).
2. Check the student's response against each key concept.
3. "mentioned" = clearly stated the concept correctly
4. "partial_mentions" = alluded to it or got it partially right
5. "missed" = not mentioned or stated incorrectly

FEEDBACK TONE:
- Start by acknowledging what they got right — be specific ("Great job remembering that X leads to Y").
- For missed concepts, give a brief 1-sentence reminder of what they missed.
- End with encouragement and a suggestion for what to review.

Return JSON: {"mentioned": [...], "partial_mentions": [...], "missed": [...],
"mentioned_count": int, "total_key_concepts": int, "score_fraction": "N/M", "feedback": "..."}"""


# ── Endpoints ──────────────────────────────────────────────────


@router.post("/blurting/exercises", response_model=BlurtingExerciseResponse)
async def generate_blurting_exercises(request: Request, data: BlurtingExerciseRequest):
    user_id = _get_user_id(request, data.user_id)

    briefing_ctx = ""
    try:
        briefing = get_tutor_briefing(user_id)
        if briefing.weak_concepts:
            weak = ", ".join(c.name for c in briefing.weak_concepts[:3])
            briefing_ctx = f"\nStudent weak areas (prioritize): {weak}"
    except Exception:
        pass

    messages = [
        {"role": "system", "content": EXERCISE_SYSTEM},
        {"role": "user", "content": f"Teaching content:\n{data.teaching_block[:1200]}{briefing_ctx}"},
    ]

    text = call_messages(messages, response_format={"type": "json_object"}, max_tokens=2000)

    try:
        parsed = json.loads(text)
        exercises = parsed.get("exercises", [])
        while len(exercises) < 3:
            exercises.append({"prompt": "Recall key concepts.", "focus": "General recall"})
    except Exception as e:
        logger.error("Blurting exercise parse failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to generate exercises")

    return BlurtingExerciseResponse(
        exercise_1=ExerciseItem(**exercises[0]),
        exercise_2=ExerciseItem(**exercises[1]),
        exercise_3=ExerciseItem(**exercises[2]),
    )


@router.post("/blurting/feedback", response_model=BlurtingFeedbackResponse)
async def evaluate_blurting_feedback(request: Request, data: BlurtingFeedbackRequest):
    user_id = _get_user_id(request, data.user_id)

    messages = [
        {"role": "system", "content": FEEDBACK_SYSTEM},
        {
            "role": "user",
            "content": f"Exercise question: {data.exercise_question}\n\nStudent's response:\n{data.blurted_response[:800]}",
        },
    ]

    text = call_messages(messages, response_format={"type": "json_object"}, max_tokens=2000)

    try:
        parsed = json.loads(text)
        mentioned_count = int(parsed.get("mentioned_count", 0))
        total = int(parsed.get("total_key_concepts", 1))
        score = mentioned_count / total if total > 0 else 0.0
    except Exception as e:
        logger.error("Blurting feedback parse failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to evaluate response")

    # Record attempt
    if data.concept_name:
        try:
            concept_id = ensure_concept(data.concept_name, data.topic)
            record_attempt(AttemptRecord(
                user_id=UUID(user_id),
                concept_id=UUID(concept_id),
                mode="blurting",
                score=score,
            ))
        except Exception as e:
            logger.warning("Failed to record blurting attempt: %s", e)

    return BlurtingFeedbackResponse(
        mentioned=parsed.get("mentioned", []),
        partial_mentions=parsed.get("partial_mentions", []),
        missed=parsed.get("missed", []),
        mentioned_count=mentioned_count,
        total_key_concepts=total,
        score_fraction=parsed.get("score_fraction", f"{mentioned_count}/{total}"),
        score=round(score, 3),
        feedback=parsed.get("feedback", ""),
    )
