"""Session orchestrator — the tutoring brain.

Runs adaptive sessions built on learning-science principles:
diagnose → teach → practice (retrieval) → assess → review.

The decision of what to do next is deterministic. The LLM (Haiku) is
only used for qualitative generation (teaching content, grading rubrics).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.services.learner_context import (
    ConceptSnapshot,
    TutorBriefing,
    get_tutor_briefing,
    record_attempt,
    AttemptRecord,
    ensure_concept,
)
from app.services.mastery import (
    MasteryState,
    is_in_struggle_zone,
    select_items,
)

logger = logging.getLogger(__name__)


# ── Types ───────────────────────────────────────────────────────


class SessionIntent(str, Enum):
    QUICK_REVIEW = "quick_review"       # 5-10 min, due items only
    LEARN_NEW = "learn_new"             # teach + first practice
    DEEP_SESSION = "deep_session"       # full arc
    EXAM_PREP = "exam_prep"             # breadth + weak-area drilling


class StepMode(str, Enum):
    DIAGNOSE = "diagnose"
    TEACH = "teach"
    QUIZ = "quiz"
    FLASHCARD = "flashcard"
    FEYNMAN = "feynman"
    BLURTING = "blurting"
    SOCRATIC = "socratic"
    REVIEW = "review"


class SessionStep(BaseModel):
    step_number: int
    mode: StepMode
    concept_id: UUID
    concept_name: str
    difficulty: str = "medium"
    rationale: str = ""
    completed: bool = False
    score: Optional[float] = None
    confidence_before: Optional[float] = None
    confidence_after: Optional[float] = None


class SessionPlan(BaseModel):
    session_id: UUID = Field(default_factory=uuid4)
    user_id: UUID
    intent: SessionIntent
    steps: list[SessionStep] = Field(default_factory=list)
    current_step: int = 0
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: Optional[datetime] = None


class SessionSummary(BaseModel):
    session_id: UUID
    intent: SessionIntent
    total_steps: int
    completed_steps: int
    concepts_practiced: list[str]
    improved: list[str]
    still_weak: list[str]
    scheduled_next: list[str]
    time_on_task_seconds: int
    average_score: float


class NextStepResponse(BaseModel):
    step: Optional[SessionStep] = None
    done: bool = False
    summary: Optional[SessionSummary] = None


# ── Config per intent ───────────────────────────────────────────

INTENT_CONFIG = {
    SessionIntent.QUICK_REVIEW: {"max_steps": 6, "modes": [StepMode.QUIZ, StepMode.FLASHCARD], "teach": False},
    SessionIntent.LEARN_NEW: {"max_steps": 8, "modes": [StepMode.TEACH, StepMode.SOCRATIC, StepMode.QUIZ, StepMode.FEYNMAN], "teach": True},
    SessionIntent.DEEP_SESSION: {"max_steps": 12, "modes": [StepMode.DIAGNOSE, StepMode.TEACH, StepMode.SOCRATIC, StepMode.QUIZ, StepMode.FEYNMAN, StepMode.BLURTING, StepMode.REVIEW], "teach": True},
    SessionIntent.EXAM_PREP: {"max_steps": 15, "modes": [StepMode.QUIZ, StepMode.FLASHCARD, StepMode.BLURTING], "teach": False},
}


# ── Session store (in-memory per process, keyed by session_id) ──
# This is ephemeral session state, not the source of truth.
# The source of truth is Postgres (attempts + learner_concept_state).
_active_sessions: dict[str, SessionPlan] = {}


# ── Public API ──────────────────────────────────────────────────


def create_session(
    user_id: str,
    intent: SessionIntent,
    topic: Optional[str] = None,
) -> SessionPlan:
    """Plan a new adaptive session based on the learner model."""
    briefing = get_tutor_briefing(user_id)
    config = INTENT_CONFIG[intent]

    concepts = _select_session_concepts(briefing, intent, topic)

    # If no concepts exist yet, bootstrap from the topic
    if not concepts and topic:
        clean_name = _extract_topic_name(topic)
        concept_id = ensure_concept(clean_name, clean_name)
        concepts = [ConceptSnapshot(
            concept_id=UUID(concept_id), name=clean_name, topic=clean_name,
            mastery=0.0, uncertainty=1.0, streak=0, priority=1.0,
        )]
    elif not concepts:
        raise ValueError("No concepts available for session. Please specify a topic.")

    steps = _build_step_sequence(concepts, config, intent)

    plan = SessionPlan(
        user_id=UUID(user_id),
        intent=intent,
        steps=steps,
    )

    # Persist session to Postgres
    _persist_session(plan)
    _active_sessions[str(plan.session_id)] = plan

    return plan


def get_current_step(session_id: str) -> NextStepResponse:
    """Return the current step the student should work on."""
    plan = _get_plan(session_id)
    if plan is None:
        return NextStepResponse(done=True)

    if plan.current_step >= len(plan.steps):
        return _finish_session(plan)

    return NextStepResponse(step=plan.steps[plan.current_step])


def submit_step(
    session_id: str,
    score: float,
    confidence_before: Optional[float] = None,
) -> NextStepResponse:
    """Submit a graded result for the current step and advance."""
    plan = _get_plan(session_id)
    if plan is None or plan.current_step >= len(plan.steps):
        return NextStepResponse(done=True)

    step = plan.steps[plan.current_step]
    step.score = score
    step.confidence_before = confidence_before
    step.completed = True

    # Record into the learner model
    record_attempt(AttemptRecord(
        user_id=plan.user_id,
        concept_id=step.concept_id,
        session_id=plan.session_id,
        mode=step.mode.value,
        score=score,
    ))

    # Adaptive rules
    _apply_adaptive_rules(plan, step, score)

    plan.current_step += 1

    if plan.current_step >= len(plan.steps):
        return _finish_session(plan)

    return NextStepResponse(step=plan.steps[plan.current_step])


def get_session_plan(session_id: str) -> Optional[SessionPlan]:
    return _get_plan(session_id)


# ── Adaptive rules (deterministic) ─────────────────────────────


def _apply_adaptive_rules(plan: SessionPlan, step: SessionStep, score: float) -> None:
    """Modify the remaining plan based on the student's performance."""
    config = INTENT_CONFIG[plan.intent]
    remaining_capacity = config["max_steps"] - len(plan.steps)

    if score < 0.5:
        # Wrong → re-teach lighter + re-queue sooner
        if remaining_capacity > 0 and config.get("teach"):
            plan.steps.append(SessionStep(
                step_number=len(plan.steps),
                mode=StepMode.TEACH,
                concept_id=step.concept_id,
                concept_name=step.concept_name,
                difficulty="easy",
                rationale=f"Re-teaching {step.concept_name} after incorrect answer",
            ))
        if remaining_capacity > 1:
            plan.steps.append(SessionStep(
                step_number=len(plan.steps),
                mode=StepMode.QUIZ,
                concept_id=step.concept_id,
                concept_name=step.concept_name,
                difficulty="easy",
                rationale=f"Re-queued {step.concept_name} at lower difficulty",
            ))

    elif score >= 0.85:
        # Mastered → fade support, potentially interleave something new
        next_steps = plan.steps[plan.current_step + 1:]
        same_concept_upcoming = [
            s for s in next_steps
            if s.concept_id == step.concept_id and not s.completed
        ]
        for s in same_concept_upcoming:
            s.difficulty = _raise_difficulty(s.difficulty)

    # Streak detection: 3+ correct on same concept → advance
    recent_scores = [
        s.score for s in plan.steps
        if s.completed and s.concept_id == step.concept_id and s.score is not None
    ]
    if len(recent_scores) >= 3 and all(s >= 0.7 for s in recent_scores[-3:]):
        next_steps = plan.steps[plan.current_step + 1:]
        for s in next_steps:
            if s.concept_id == step.concept_id and not s.completed:
                s.difficulty = _raise_difficulty(s.difficulty)


# ── Internal helpers ────────────────────────────────────────────


def _select_session_concepts(
    briefing: TutorBriefing,
    intent: SessionIntent,
    topic: Optional[str],
) -> list[ConceptSnapshot]:
    """Pick concepts for the session from the briefing."""
    if intent == SessionIntent.QUICK_REVIEW:
        pool = briefing.due_reviews or briefing.weak_concepts
    elif intent == SessionIntent.LEARN_NEW:
        pool = [c for c in briefing.weak_concepts if c.mastery < 0.3]
        if not pool:
            pool = briefing.weak_concepts
    elif intent == SessionIntent.EXAM_PREP:
        all_concepts = briefing.weak_concepts + briefing.due_reviews
        seen_ids = set()
        pool = []
        for c in all_concepts:
            if c.concept_id not in seen_ids:
                pool.append(c)
                seen_ids.add(c.concept_id)
    else:
        pool = briefing.weak_concepts + briefing.due_reviews
        seen_ids = set()
        deduped = []
        for c in pool:
            if c.concept_id not in seen_ids:
                deduped.append(c)
                seen_ids.add(c.concept_id)
        pool = deduped

    if topic:
        topic_filtered = [c for c in pool if c.topic and topic.lower() in c.topic.lower()]
        if topic_filtered:
            pool = topic_filtered

    config = INTENT_CONFIG[intent]
    max_concepts = max(2, config["max_steps"] // 3)
    return pool[:max_concepts]


def _build_step_sequence(
    concepts: list[ConceptSnapshot],
    config: dict,
    intent: SessionIntent,
) -> list[SessionStep]:
    """Build the step sequence interleaving concepts across modes."""
    if not concepts:
        return []

    steps: list[SessionStep] = []
    modes = config["modes"]
    step_num = 0

    if intent == SessionIntent.DEEP_SESSION and StepMode.DIAGNOSE in modes:
        for c in concepts:
            steps.append(SessionStep(
                step_number=step_num,
                mode=StepMode.DIAGNOSE,
                concept_id=c.concept_id,
                concept_name=c.name,
                difficulty=_mastery_to_difficulty(c.mastery),
                rationale=f"Diagnosing current understanding of {c.name}",
            ))
            step_num += 1

    practice_modes = [m for m in modes if m not in (StepMode.DIAGNOSE, StepMode.REVIEW)]

    if config.get("teach") and StepMode.TEACH in modes:
        for c in concepts:
            steps.append(SessionStep(
                step_number=step_num,
                mode=StepMode.TEACH,
                concept_id=c.concept_id,
                concept_name=c.name,
                difficulty=_mastery_to_difficulty(c.mastery),
                rationale=f"Learning {c.name}",
            ))
            step_num += 1

    retrieval_modes = [m for m in practice_modes if m != StepMode.TEACH]
    if not retrieval_modes:
        retrieval_modes = [StepMode.QUIZ]

    # Interleave concepts across retrieval modes
    mode_idx = 0
    for _ in range(2):  # two rounds of practice
        for c in concepts:
            if step_num >= config["max_steps"] - 1:
                break
            mode = retrieval_modes[mode_idx % len(retrieval_modes)]
            steps.append(SessionStep(
                step_number=step_num,
                mode=mode,
                concept_id=c.concept_id,
                concept_name=c.name,
                difficulty=_mastery_to_difficulty(c.mastery),
                rationale=f"Practice {c.name} via {mode.value}",
            ))
            step_num += 1
            mode_idx += 1

    if StepMode.REVIEW in modes and step_num < config["max_steps"]:
        steps.append(SessionStep(
            step_number=step_num,
            mode=StepMode.REVIEW,
            concept_id=concepts[0].concept_id,
            concept_name="Session Review",
            rationale="End-of-session review and summary",
        ))

    return steps


def _extract_topic_name(raw: str) -> str:
    """Clean user input like 'teach me bio' into a proper concept name like 'Biology'."""
    import re
    cleaned = re.sub(
        r'^(teach\s+me\s+|learn\s+|study\s+|help\s+(me\s+)?(with\s+)?|i\s+want\s+to\s+(learn|study)\s+|explain\s+)',
        '', raw.strip(), flags=re.IGNORECASE,
    ).strip()
    if not cleaned:
        cleaned = raw.strip()
    EXPANSIONS = {
        'bio': 'Biology', 'chem': 'Chemistry', 'phys': 'Physics',
        'math': 'Mathematics', 'maths': 'Mathematics', 'cs': 'Computer Science',
        'econ': 'Economics', 'psych': 'Psychology', 'eng': 'English',
        'calc': 'Calculus', 'stats': 'Statistics', 'geo': 'Geography',
        'hist': 'History', 'gov': 'Government', 'lit': 'Literature',
    }
    lower = cleaned.lower()
    if lower in EXPANSIONS:
        return EXPANSIONS[lower]
    return cleaned.title() if len(cleaned) < 40 else cleaned[:40].title()


def _mastery_to_difficulty(mastery: float) -> str:
    if mastery < 0.3:
        return "easy"
    if mastery < 0.6:
        return "medium"
    if mastery < 0.85:
        return "hard"
    return "expert"


def _raise_difficulty(current: str) -> str:
    levels = ["easy", "medium", "hard", "expert"]
    idx = levels.index(current) if current in levels else 1
    return levels[min(idx + 1, len(levels) - 1)]


def _get_plan(session_id: str) -> Optional[SessionPlan]:
    return _active_sessions.get(session_id)


def _persist_session(plan: SessionPlan) -> None:
    """Save session to Postgres."""
    try:
        from app.services.context import get_supabase
        supabase = get_supabase()
        plan_json = json.loads(json.dumps(
            {"steps": [s.dict() for s in plan.steps]},
            default=str,
        ))
        supabase.table("sessions").insert({
            "id": str(plan.session_id),
            "user_id": str(plan.user_id),
            "intent": plan.intent.value,
            "plan": plan_json,
            "started_at": plan.started_at.isoformat(),
        }).execute()
    except Exception as e:
        logger.error("Failed to persist session: %s", e)


def _finish_session(plan: SessionPlan) -> NextStepResponse:
    """Generate end-of-session summary."""
    plan.ended_at = datetime.now(timezone.utc)

    completed_steps = [s for s in plan.steps if s.completed]
    scores = [s.score for s in completed_steps if s.score is not None]

    concepts_practiced = list({s.concept_name for s in completed_steps})

    improved = []
    still_weak = []
    for name in concepts_practiced:
        concept_scores = [
            s.score for s in completed_steps
            if s.concept_name == name and s.score is not None
        ]
        if len(concept_scores) >= 2 and concept_scores[-1] > concept_scores[0]:
            improved.append(name)
        elif concept_scores and concept_scores[-1] < 0.7:
            still_weak.append(name)

    time_on_task = int((plan.ended_at - plan.started_at).total_seconds())

    summary = SessionSummary(
        session_id=plan.session_id,
        intent=plan.intent,
        total_steps=len(plan.steps),
        completed_steps=len(completed_steps),
        concepts_practiced=concepts_practiced,
        improved=improved,
        still_weak=still_weak,
        scheduled_next=still_weak[:3],
        time_on_task_seconds=time_on_task,
        average_score=round(sum(scores) / len(scores), 3) if scores else 0.0,
    )

    # Update session in Postgres
    try:
        from app.services.context import get_supabase
        supabase = get_supabase()
        outcomes_json = json.loads(json.dumps(summary.dict(), default=str))
        supabase.table("sessions").update({
            "ended_at": plan.ended_at.isoformat(),
            "outcomes": outcomes_json,
        }).eq("id", str(plan.session_id)).execute()
    except Exception as e:
        logger.error("Failed to update session: %s", e)

    # Clean up
    _active_sessions.pop(str(plan.session_id), None)

    return NextStepResponse(done=True, summary=summary)
