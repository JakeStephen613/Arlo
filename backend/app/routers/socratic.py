"""Socratic dialogue mode — multi-turn conversational tutoring.

Instead of one-shot quiz/flashcard, Claude engages in back-and-forth
dialogue: asks questions, follows up based on answers, provides hints,
and adjusts difficulty dynamically. Mastery is assessed from the
conversation itself.
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json
import logging

from app.services.llm import call_messages, stream_messages
from app.services.learner_context import ensure_concept, record_attempt, AttemptRecord

logger = logging.getLogger(__name__)
router = APIRouter()

SOCRATIC_SYSTEM = """You are a Socratic tutor. Your goal is to help the student truly understand a concept through guided questioning — never just tell them the answer.

RULES:
1. Start with a clear, specific question about the concept
2. Based on their response:
   - If correct: acknowledge briefly, then ask a deeper follow-up
   - If partially correct: acknowledge what's right, give a small hint, ask again
   - If wrong: don't say "wrong" — ask a simpler sub-question to guide them
   - If stuck: provide a hint or analogy, then re-ask
3. Vary question types: conceptual, application, comparison, "what if" scenarios
4. After 4-6 exchanges, synthesize what they've demonstrated understanding of
5. Be encouraging but honest — celebrate genuine understanding

RESPONSE FORMAT (JSON):
{
  "message": "Your response to the student",
  "question": "Your next question (null if conversation is ending)",
  "assessment": {
    "understanding_level": "none|partial|good|strong",
    "concepts_demonstrated": ["list of concepts they've shown understanding of"],
    "gaps": ["concepts they're still missing"],
    "mastery_estimate": 0.0-1.0
  },
  "hints_given": 0,
  "should_continue": true,
  "turn_number": 1
}"""


def _get_user_id(request: Request) -> str:
    user = getattr(request.state, "user", {})
    uid = user.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


class SocraticStartRequest(BaseModel):
    concept_name: str
    topic: Optional[str] = None
    difficulty: str = "medium"
    context: Optional[str] = None


class SocraticReplyRequest(BaseModel):
    concept_name: str
    conversation: list[dict]
    student_response: str


class SocraticResponse(BaseModel):
    message: str
    question: Optional[str] = None
    understanding_level: str = "none"
    concepts_demonstrated: list[str] = []
    gaps: list[str] = []
    mastery_estimate: float = 0.0
    should_continue: bool = True
    turn_number: int = 1


@router.post("/socratic/start")
async def start_dialogue(request: Request, data: SocraticStartRequest):
    _get_user_id(request)

    context_str = ""
    if data.context:
        context_str = f"\n\nCONTEXT: {data.context[:1000]}"

    messages = [
        {"role": "system", "content": SOCRATIC_SYSTEM},
        {"role": "user", "content": f"Start a Socratic dialogue about: {data.concept_name}. Difficulty: {data.difficulty}. Topic area: {data.topic or data.concept_name}.{context_str}\n\nBegin with your first question."},
    ]

    schema = SocraticOutputSchema.model_json_schema()
    raw = call_messages(messages, response_format={
        "type": "json_schema",
        "json_schema": {"name": "socratic_response", "schema": schema},
    })

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {"message": "Let's explore this concept together.", "question": f"Can you explain what {data.concept_name} means in your own words?", "assessment": {"understanding_level": "none", "concepts_demonstrated": [], "gaps": [], "mastery_estimate": 0.0}, "hints_given": 0, "should_continue": True, "turn_number": 1}

    assessment = parsed.get("assessment", {})
    return SocraticResponse(
        message=parsed.get("message", ""),
        question=parsed.get("question"),
        understanding_level=assessment.get("understanding_level", "none"),
        concepts_demonstrated=assessment.get("concepts_demonstrated", []),
        gaps=assessment.get("gaps", []),
        mastery_estimate=assessment.get("mastery_estimate", 0.0),
        should_continue=parsed.get("should_continue", True),
        turn_number=parsed.get("turn_number", 1),
    )


@router.post("/socratic/reply")
async def reply_dialogue(request: Request, data: SocraticReplyRequest):
    user_id = _get_user_id(request)

    messages = [
        {"role": "system", "content": SOCRATIC_SYSTEM},
    ]
    for msg in data.conversation[-10:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": data.student_response})

    schema = SocraticOutputSchema.model_json_schema()
    raw = call_messages(messages, response_format={
        "type": "json_schema",
        "json_schema": {"name": "socratic_response", "schema": schema},
    })

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {"message": "Interesting. Can you elaborate on that?", "question": "What else can you tell me about this?", "assessment": {"understanding_level": "partial", "concepts_demonstrated": [], "gaps": [], "mastery_estimate": 0.3}, "hints_given": 0, "should_continue": True, "turn_number": len(data.conversation) + 1}

    assessment = parsed.get("assessment", {})
    mastery = assessment.get("mastery_estimate", 0.0)

    # Record attempt when conversation ends
    if not parsed.get("should_continue", True):
        try:
            from uuid import UUID
            concept_id = ensure_concept(data.concept_name, data.concept_name)
            record_attempt(AttemptRecord(
                user_id=UUID(user_id),
                concept_id=UUID(concept_id),
                mode="socratic",
                score=mastery,
                metadata={"turns": parsed.get("turn_number", 0), "concepts_demonstrated": assessment.get("concepts_demonstrated", [])},
            ))
        except Exception as e:
            logger.warning("Failed to record socratic attempt: %s", e)

    return SocraticResponse(
        message=parsed.get("message", ""),
        question=parsed.get("question"),
        understanding_level=assessment.get("understanding_level", "none"),
        concepts_demonstrated=assessment.get("concepts_demonstrated", []),
        gaps=assessment.get("gaps", []),
        mastery_estimate=mastery,
        should_continue=parsed.get("should_continue", True),
        turn_number=parsed.get("turn_number", 1),
    )


class SocraticAssessment(BaseModel):
    understanding_level: str
    concepts_demonstrated: list[str]
    gaps: list[str]
    mastery_estimate: float
    model_config = {"extra": "forbid"}


class SocraticOutputSchema(BaseModel):
    message: str
    question: Optional[str] = None
    assessment: SocraticAssessment
    hints_given: int
    should_continue: bool
    turn_number: int
    model_config = {"extra": "forbid"}
