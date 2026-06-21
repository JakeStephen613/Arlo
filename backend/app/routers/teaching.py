"""Teaching module — streams micro-lessons via SSE with inline check-questions.

Consumes TutorBriefing, targets specific concepts at chosen difficulty,
grades check-question responses, and calls record_attempt().
"""
from __future__ import annotations

import json
import logging
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.llm import call_messages, stream_messages
from app.services.learner_context import (
    get_tutor_briefing,
    record_attempt,
    ensure_concept,
    AttemptRecord,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request / Response models ─────────────────────────────────


class TeachingRequest(BaseModel):
    topic: str
    subject: Optional[str] = None
    level: Optional[str] = "intermediate"
    concept_name: Optional[str] = None
    difficulty: Optional[str] = "medium"
    user_id: Optional[str] = None


class TeachingBlock(BaseModel):
    title: str
    content: str


class CombinedResponse(BaseModel):
    lesson: List[TeachingBlock]
    status: str


class CheckQuestionRequest(BaseModel):
    question: str
    user_answer: str
    concept_name: str
    topic: Optional[str] = None
    user_id: Optional[str] = None


class CheckQuestionResponse(BaseModel):
    correct: bool
    score: float
    explanation: str


class FollowUpRequest(BaseModel):
    original_topic: str
    follow_up: str
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


TEACHING_SYSTEM = """You are an expert tutor who excels at teaching difficult content simply.
Sound like you're talking directly to the student, never like a textbook.

STYLE:
- Use **simple words**, explain technical terms in plain English
- Include relatable analogies, examples, or metaphors
- Conversational tone: rhetorical questions, "think of it like…", "imagine…"
- Structure with bullet points when helpful
- Use **bold** for important terms

STRUCTURE:
- Write 6-10 short sections, each covering 1-2 subtopics
- Each section: 60-120 words
- Between sections 3 and 4, and between sections 6 and 7, insert a CHECK QUESTION
- Format check questions exactly as: [CHECK] question text here [/CHECK]
- Check questions should test recall of what was just taught
- Only mention information relevant to understanding the topic"""


def _build_briefing_context(user_id: str) -> str:
    try:
        briefing = get_tutor_briefing(user_id)
        if not briefing.weak_concepts:
            return ""
        weak = ", ".join(
            f"{c.name} ({c.mastery:.0%})" for c in briefing.weak_concepts[:5]
        )
        return f"\n\nSTUDENT CONTEXT: Weak areas: {weak}. Average mastery: {briefing.average_mastery:.0%}."
    except Exception:
        return ""


# ── SSE streaming endpoint (Step 5) ───────────────────────────


@router.post("/teaching/stream")
async def stream_teaching(request: Request, req: TeachingRequest):
    """Stream a teaching lesson token-by-token via SSE."""
    user_id = _get_user_id(request, req.user_id)
    briefing_ctx = _build_briefing_context(user_id)

    difficulty_instruction = ""
    if req.difficulty == "easy":
        difficulty_instruction = "\nUse very simple language, more analogies, shorter sections."
    elif req.difficulty == "hard":
        difficulty_instruction = "\nAssume some prior knowledge, go deeper into mechanisms and edge cases."

    messages = [
        {"role": "system", "content": TEACHING_SYSTEM + briefing_ctx + difficulty_instruction},
        {
            "role": "user",
            "content": f"Teach me about: {req.topic}"
            + (f"\nSubject: {req.subject}" if req.subject else "")
            + (f"\nLevel: {req.level}" if req.level else ""),
        },
    ]

    async def event_stream():
        try:
            buffer = ""
            section_count = 0
            async for token in stream_messages(messages):
                buffer += token

                # Detect section breaks for structured chunk events
                if "\n## " in buffer or "\n**" in buffer:
                    section_count += 1

                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            # Record teaching as an attempt if concept is specified
            if req.concept_name:
                try:
                    concept_id = ensure_concept(req.concept_name, req.topic)
                    record_attempt(AttemptRecord(
                        user_id=UUID(user_id),
                        concept_id=UUID(concept_id),
                        mode="teach",
                        score=0.5,
                        metadata={"difficulty": req.difficulty or "medium"},
                    ))
                except Exception as e:
                    logger.warning("Failed to record teaching attempt: %s", e)

            yield f"data: {json.dumps({'type': 'done', 'sections': section_count})}\n\n"
        except Exception as e:
            logger.error("Streaming error: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Non-streaming fallback (original endpoint) ────────────────


@router.post("/combined", response_model=CombinedResponse)
async def get_combined_content(request: Request, req: TeachingRequest):
    user_id = _get_user_id(request, req.user_id)
    briefing_ctx = _build_briefing_context(user_id)

    messages = [
        {"role": "system", "content": TEACHING_SYSTEM + briefing_ctx
         + "\n\nReturn a JSON object: {\"lesson\": [{\"title\": \"...\", \"content\": \"...\"}]}. "
         + "Output 8-14 blocks. Return ONLY valid JSON."},
        {
            "role": "user",
            "content": f"Create a comprehensive lesson about: {req.topic}"
            + (f"\nSubject: {req.subject}" if req.subject else ""),
        },
    ]

    text = call_messages(
        messages,
        response_format={"type": "json_object"},
        max_tokens=6000,
    )

    try:
        data = json.loads(text)
        blocks = [TeachingBlock(**b) for b in data.get("lesson", [])]
    except (json.JSONDecodeError, Exception) as e:
        logger.error("Failed to parse teaching response: %s", e)
        raise HTTPException(status_code=500, detail="Failed to generate lesson")

    if req.concept_name:
        try:
            concept_id = ensure_concept(req.concept_name, req.topic)
            record_attempt(AttemptRecord(
                user_id=UUID(user_id),
                concept_id=UUID(concept_id),
                mode="teach",
                score=0.5,
                metadata={"difficulty": req.difficulty or "medium"},
            ))
        except Exception as e:
            logger.warning("Failed to record teaching attempt: %s", e)

    return CombinedResponse(lesson=blocks, status="success")


# ── Check-question grading ─────────────────────────────────────


@router.post("/teaching/check", response_model=CheckQuestionResponse)
async def grade_check_question(request: Request, req: CheckQuestionRequest):
    """Grade an inline check-question from a teaching session."""
    user_id = _get_user_id(request, req.user_id)

    messages = [
        {
            "role": "system",
            "content": "Grade this student's answer. Return JSON: "
            '{"correct": bool, "score": float 0-1, "explanation": "one sentence why"}',
        },
        {
            "role": "user",
            "content": f"Question: {req.question}\nStudent answer: {req.user_answer}",
        },
    ]

    text = call_messages(messages, response_format={"type": "json_object"}, max_tokens=300)

    try:
        data = json.loads(text)
        score = float(data.get("score", 0.5))
    except Exception:
        score = 0.5
        data = {"correct": False, "score": 0.5, "explanation": "Could not grade answer."}

    concept_id = ensure_concept(req.concept_name, req.topic)
    record_attempt(AttemptRecord(
        user_id=UUID(user_id),
        concept_id=UUID(concept_id),
        mode="teach_check",
        score=score,
    ))

    return CheckQuestionResponse(
        correct=data.get("correct", score >= 0.5),
        score=score,
        explanation=data.get("explanation", ""),
    )


# ── Follow-up / "explain differently" ─────────────────────────


@router.post("/teaching/followup")
async def teaching_followup(request: Request, req: FollowUpRequest):
    """Stream a follow-up explanation without leaving the teaching flow."""
    _get_user_id(request, req.user_id)

    messages = [
        {
            "role": "system",
            "content": "You are an expert tutor. The student was just learning about the topic below "
            "and has a follow-up question. Answer concisely (3-5 sentences) in a conversational style.",
        },
        {
            "role": "user",
            "content": f"Topic: {req.original_topic}\nQuestion: {req.follow_up}",
        },
    ]

    async def event_stream():
        async for token in stream_messages(messages, max_tokens=1000):
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/combined/health")
async def health_check():
    from app.core.config import ANTHROPIC_API_KEY
    return {"status": "healthy", "anthropic_api": "ok" if ANTHROPIC_API_KEY else "missing"}
