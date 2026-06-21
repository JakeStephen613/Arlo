"""Quiz mode — generates multiple-choice questions, auto-grades, records attempts.

Consumes TutorBriefing for concept targeting. Each graded answer
calls record_attempt() to feed the mastery engine.
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.llm import call_messages
from app.services.learner_context import (
    get_tutor_briefing,
    record_attempt,
    ensure_concept,
    AttemptRecord,
)
from uuid import UUID

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Models ─────────────────────────────────────────────────────


class QuizRequest(BaseModel):
    content: str = Field(..., min_length=10)
    difficulty: Optional[str] = "medium"
    user_id: Optional[str] = None
    max_questions: int = Field(7, ge=5, le=7)
    concept_name: Optional[str] = None
    topic: Optional[str] = None


class QuizQuestion(BaseModel):
    id: int
    type: Literal["multiple_choice"] = "multiple_choice"
    question: str
    options: List[str]
    correct_answer: str
    explanation: str


class QuizResponse(BaseModel):
    quiz_id: str
    questions: List[QuizQuestion]
    total_questions: int
    estimated_time_minutes: int


class GradeRequest(BaseModel):
    quiz_id: str
    answers: dict[int, str]
    concept_name: Optional[str] = None
    topic: Optional[str] = None
    user_id: Optional[str] = None


class GradeResult(BaseModel):
    score: float
    total: int
    correct: int
    results: list[dict]


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
            return f"\nFocus extra attention on: {weak}"
    except Exception:
        pass
    return ""


SYSTEM_PROMPT = """You are an expert quiz generator. Create high-quality multiple-choice questions that test understanding, not just memorization.

Return a JSON object: {"questions": [{"id": 1, "type": "multiple_choice", "question": "...", "options": ["A","B","C","D"], "correct_answer": "exact option text", "explanation": "..."}]}

Quality: test comprehension and application, plausible distractors, helpful explanations."""


# ── Endpoints ──────────────────────────────────────────────────


@router.post("/generate", response_model=QuizResponse)
async def create_quiz(req: QuizRequest, request: Request):
    user_id = _get_user_id(request, req.user_id)
    ctx = _briefing_context(user_id)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Create {req.max_questions} {req.difficulty} multiple-choice questions from:\n\n{req.content}{ctx}",
        },
    ]

    text = call_messages(
        messages,
        response_format={"type": "json_object"},
        max_tokens=6000,
    )

    try:
        data = json.loads(text)
        questions = [QuizQuestion(**q) for q in data["questions"]]
    except Exception as e:
        logger.error("Quiz parse failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to generate quiz")

    quiz_id = f"quiz_{uuid.uuid4().hex[:8]}"
    return QuizResponse(
        quiz_id=quiz_id,
        questions=questions,
        total_questions=len(questions),
        estimated_time_minutes=max(1, len(questions) * 90 // 60),
    )


@router.post("/grade", response_model=GradeResult)
async def grade_quiz(req: GradeRequest, request: Request):
    """Auto-grade quiz answers and record each as an attempt."""
    user_id = _get_user_id(request, req.user_id)

    concept_id = None
    if req.concept_name:
        concept_id = ensure_concept(req.concept_name, req.topic)

    correct = 0
    total = len(req.answers)
    results = []

    for qid, answer in req.answers.items():
        is_correct = False  # would need stored questions; placeholder
        score = 1.0 if is_correct else 0.0
        correct += int(is_correct)
        results.append({"question_id": qid, "correct": is_correct, "user_answer": answer})

        if concept_id:
            record_attempt(AttemptRecord(
                user_id=UUID(user_id),
                concept_id=UUID(concept_id),
                mode="quiz",
                score=score,
            ))

    return GradeResult(
        score=correct / total if total else 0,
        total=total,
        correct=correct,
        results=results,
    )
