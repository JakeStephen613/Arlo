"""Feynman mode — generates conceptual questions, grades explanations via Haiku rubric.

Consumes TutorBriefing, grades with a 0-1 rubric, calls record_attempt().
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


class FeynmanExerciseRequest(BaseModel):
    teaching_content: str
    user_id: Optional[str] = None
    concept_name: Optional[str] = None
    topic: Optional[str] = None


class FeynmanExerciseResponse(BaseModel):
    questions: List[str]


class FeynmanAssessmentRequest(BaseModel):
    question: str
    user_explanation: str
    user_id: Optional[str] = None
    concept_name: Optional[str] = None
    topic: Optional[str] = None


class FeynmanAssessmentResponse(BaseModel):
    mastery_score: int
    score: float
    what_went_well: List[str]
    gaps_in_understanding: List[str]


# ── Helpers ────────────────────────────────────────────────────


def _get_user_id(request: Request, fallback: Optional[str] = None) -> str:
    user = getattr(request.state, "user", {})
    uid = user.get("sub")
    if uid:
        return uid
    if fallback:
        return fallback
    raise HTTPException(status_code=401, detail="Not authenticated")


EXERCISE_SYSTEM = """Create exactly 3 Feynman-style teaching prompts that ask the student to EXPLAIN a concept in their own words, as if teaching someone who has never heard of it.

PROMPT QUALITY REQUIREMENTS:
- Each prompt should target a different aspect: one foundational, one about relationships/processes, one about real-world application.
- Prompts should be open-ended enough for a paragraph-length response, not answerable in one word.
- Use language like "Explain...", "Describe how...", "Walk someone through...", "Why does..."
- Do NOT ask for lists or definitions — ask for explanations that show understanding.

GOOD EXAMPLES:
- "Explain how natural selection leads to evolution over time. Use an example to illustrate."
- "Describe what happens inside a cell during mitosis, step by step, as if explaining to a friend."
- "Why do prices go up when demand increases but supply stays the same? Walk through the logic."

Return JSON: {"questions": ["question1", "question2", "question3"]}"""

ASSESSMENT_SYSTEM = """You are grading a student's Feynman-style explanation. Assess how well they demonstrated UNDERSTANDING, not how polished their writing is.

GRADING CRITERIA:
- Accuracy: Are the core facts correct? Any misconceptions?
- Completeness: Did they cover the key aspects, or miss major pieces?
- Depth: Did they explain WHY/HOW, or just state WHAT?
- Clarity: Could a beginner follow their explanation?

SCORING GUIDE:
- 80-100: Strong understanding, covers key concepts accurately with good explanations
- 60-79: Decent understanding but missing some important details or has minor inaccuracies
- 40-59: Partial understanding, significant gaps or misconceptions
- 0-39: Major misunderstandings or very incomplete

Be specific about gaps — name what they missed and give the correct explanation in 1 sentence.
Be genuinely encouraging about what they got right — name specific things they explained well.

Return JSON: {"mastery_score": int 0-100, "what_went_well": ["specific praise..."], "gaps_in_understanding": ["specific gap with correction..."]}"""


# ── Endpoints ──────────────────────────────────────────────────


@router.post("/feynman/exercises", response_model=FeynmanExerciseResponse)
async def generate_feynman_exercises(request: Request, payload: FeynmanExerciseRequest):
    user_id = _get_user_id(request, payload.user_id)

    briefing_ctx = ""
    try:
        briefing = get_tutor_briefing(user_id)
        if briefing.weak_concepts:
            weak = ", ".join(c.name for c in briefing.weak_concepts[:3])
            briefing_ctx = f"\nStudent weak areas: {weak}"
    except Exception:
        pass

    messages = [
        {"role": "system", "content": EXERCISE_SYSTEM},
        {
            "role": "user",
            "content": f"Teaching content:\n{payload.teaching_content[:1500]}{briefing_ctx}\n\nCreate 3 questions.",
        },
    ]

    text = call_messages(messages, response_format={"type": "json_object"}, max_tokens=2000)

    try:
        data = json.loads(text)
        questions = data.get("questions", [])[:3]
    except Exception as e:
        logger.error("Feynman exercise parse failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to generate exercises")

    return FeynmanExerciseResponse(questions=questions)


@router.post("/feynman/assess", response_model=FeynmanAssessmentResponse)
async def assess_feynman_teaching(request: Request, payload: FeynmanAssessmentRequest):
    user_id = _get_user_id(request, payload.user_id)

    messages = [
        {"role": "system", "content": ASSESSMENT_SYSTEM},
        {
            "role": "user",
            "content": f"Question: {payload.question}\n\nStudent's explanation:\n{payload.user_explanation}",
        },
    ]

    text = call_messages(messages, response_format={"type": "json_object"}, max_tokens=2000)

    try:
        import re
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        raw_json = json_match.group(0) if json_match else text
        data = json.loads(raw_json)
        mastery_score = int(data.get("mastery_score", 50))
        score = mastery_score / 100.0
    except Exception as e:
        logger.error("Feynman assessment parse failed: %s | raw: %s", e, text[:200])
        mastery_score = 50
        score = 0.5
        data = {"what_went_well": [], "gaps_in_understanding": ["Could not assess."]}

    # Record attempt
    if payload.concept_name:
        try:
            concept_id = ensure_concept(payload.concept_name, payload.topic)
            record_attempt(AttemptRecord(
                user_id=UUID(user_id),
                concept_id=UUID(concept_id),
                mode="feynman",
                score=score,
                metadata={"mastery_score": mastery_score},
            ))
        except Exception as e:
            logger.warning("Failed to record feynman attempt: %s", e)

    return FeynmanAssessmentResponse(
        mastery_score=mastery_score,
        score=score,
        what_went_well=data.get("what_went_well", []),
        gaps_in_understanding=data.get("gaps_in_understanding", []),
    )
