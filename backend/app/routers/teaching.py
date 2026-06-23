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


TEACHING_SYSTEM = """You are an expert tutor who excels at teaching difficult content in a way that is engaging and easy to understand. You sound like you're talking directly to the student, never like a textbook.

CRITICAL STYLE REQUIREMENTS:
- Always use simple words and explain technical terms in plain English the first time they appear.
- Always include relatable analogies, examples, or metaphors to ground every concept.
- Keep a conversational tone: ask rhetorical questions, say "think of it like..." or "imagine..."
- Never drift into formal research paper or lecture style.
- Never introduce advanced words without breaking them down.
- Define all technical terms at first mention. Assume the student has almost zero prior knowledge.
- Add a quick analogy or everyday example after bullet lists to ground them.

FORMATTING RULES (STRICT - FOLLOW EXACTLY):
- Do NOT use markdown headers (no # or ##).
- Use **bold** for key terms and important concepts (wrap in double asterisks).
- Do NOT use ``` or backticks.
- Use "- " or "* " for bullet points.
- Use bullet points liberally to break up information — they are easier to scan than walls of text.
- Each section should be 60-120 words. Keep it SHORT and punchy.

STRUCTURE:
- Write exactly 6-12 sections total, each covering one key idea. NEVER exceed 12 sections.
- Each section should be a substantial chunk (3-5 sentences minimum). Do NOT split individual sentences or bullet points into separate sections.
- Keep related sub-points together in the same section. A section with a heading + its bullet points = ONE section, not many.
- Be concise. The student should be able to read the entire lesson in 3-5 minutes.
- After section 3, insert: [CHECK] a recall question about what was just taught [/CHECK]
- After section 5 or 6, insert: [CHECK] a second recall question [/CHECK]
- End with a brief "Key Takeaways" section (3 bullet points max).
- NEVER create empty sections or sections with just "---" or whitespace.

EXAMPLES OF GOOD TEACHING STYLE:

"A **cell** is the smallest living piece of life that can do all the important things like grow, use energy, react to surroundings, and reproduce.

**Cell Theory** says:
- All living things are made of cells
- All cells come from other cells

Think of cells like tiny factories — each one has specialized workers (**organelles**) doing specific jobs to keep the whole operation running."

"**Economics** is the study of how people make choices about their limited resources.

Key ideas:
- **Scarcity** — Resources (money, time, food) are limited. We can't have everything.
- **Opportunity Cost** — Whenever you choose one thing, you give up the next best alternative.

Example: If you spend $10 on lunch, that's $10 you can't spend on a movie ticket. That movie ticket is your **opportunity cost**."

Now teach the requested topic using this exact style."""


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
         + "Output EXACTLY 6-12 blocks total. "
         + "CRITICAL: Every block MUST have BOTH a short title (3-6 words) AND substantial content (at least 3-4 sentences or a paragraph with bullet points). "
         + "The title is a heading label — the content is the actual teaching text. NEVER create a block where content is empty, just a title repeat, or just '---'. "
         + "Keep closely related sub-points together in ONE block. "
         + "A [CHECK] question counts as one block (title='Quick Check', content=the question text). "
         + "Return ONLY valid JSON."},
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
            "content": (
                "Grade this student's answer to a comprehension check question. "
                "Be generous with partial credit — if they show understanding of the core concept, give credit even if wording isn't perfect. "
                "Score: 1.0 = fully correct, 0.7 = mostly right with minor gap, 0.4 = partial understanding, 0.0 = wrong or no understanding. "
                "Explanation: 1-2 sentences. If correct, reinforce why. If wrong, gently explain the right answer. "
                'Return JSON: {"correct": bool, "score": float 0-1, "explanation": "..."}'
            ),
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
