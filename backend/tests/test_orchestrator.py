"""Integration test for the session orchestrator.

Tests the 8-step adaptive session scenario from Step 4 acceptance criteria.
Mocks Supabase to keep tests offline.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.services.orchestrator import (
    SessionIntent,
    SessionPlan,
    StepMode,
    SessionStep,
    _apply_adaptive_rules,
    _build_step_sequence,
    _mastery_to_difficulty,
    _raise_difficulty,
    INTENT_CONFIG,
)
from app.services.learner_context import ConceptSnapshot


NOW = datetime(2026, 6, 21, 12, 0, 0, tzinfo=timezone.utc)
C1_ID = uuid4()
C2_ID = uuid4()
C3_ID = uuid4()


def _make_concepts():
    return [
        ConceptSnapshot(concept_id=C1_ID, name="Derivatives", topic="Calculus", mastery=0.3, uncertainty=0.7),
        ConceptSnapshot(concept_id=C2_ID, name="Integrals", topic="Calculus", mastery=0.5, uncertainty=0.5),
        ConceptSnapshot(concept_id=C3_ID, name="Limits", topic="Calculus", mastery=0.15, uncertainty=0.9),
    ]


# ── Step sequence building ──────────────────────────────────────


def test_deep_session_includes_diagnose_teach_practice_review():
    concepts = _make_concepts()
    config = INTENT_CONFIG[SessionIntent.DEEP_SESSION]
    steps = _build_step_sequence(concepts, config, SessionIntent.DEEP_SESSION)

    modes_used = {s.mode for s in steps}
    assert StepMode.DIAGNOSE in modes_used
    assert StepMode.TEACH in modes_used
    assert StepMode.REVIEW in modes_used
    assert any(s.mode in (StepMode.QUIZ, StepMode.FEYNMAN, StepMode.BLURTING) for s in steps)


def test_quick_review_no_teach():
    concepts = _make_concepts()
    config = INTENT_CONFIG[SessionIntent.QUICK_REVIEW]
    steps = _build_step_sequence(concepts, config, SessionIntent.QUICK_REVIEW)

    assert all(s.mode != StepMode.TEACH for s in steps)


def test_interleaving_concepts():
    concepts = _make_concepts()[:2]
    config = INTENT_CONFIG[SessionIntent.DEEP_SESSION]
    steps = _build_step_sequence(concepts, config, SessionIntent.DEEP_SESSION)

    practice_steps = [s for s in steps if s.mode not in (StepMode.DIAGNOSE, StepMode.TEACH, StepMode.REVIEW)]
    if len(practice_steps) >= 2:
        # At least two different concepts should appear in practice
        concept_ids = {s.concept_id for s in practice_steps}
        assert len(concept_ids) >= 2


# ── Adaptive rules ──────────────────────────────────────────────


def test_wrong_answer_requeues_and_reteaches():
    plan = SessionPlan(
        user_id=uuid4(),
        intent=SessionIntent.DEEP_SESSION,
        steps=[
            SessionStep(step_number=0, mode=StepMode.QUIZ, concept_id=C1_ID, concept_name="Derivatives"),
        ],
        current_step=0,
    )
    step = plan.steps[0]
    step.completed = True
    step.score = 0.2

    initial_len = len(plan.steps)
    _apply_adaptive_rules(plan, step, 0.2)

    assert len(plan.steps) > initial_len
    new_steps = plan.steps[initial_len:]
    assert any(s.mode == StepMode.TEACH for s in new_steps)
    assert any(s.difficulty == "easy" for s in new_steps)


def test_mastered_step_raises_difficulty():
    plan = SessionPlan(
        user_id=uuid4(),
        intent=SessionIntent.DEEP_SESSION,
        steps=[
            SessionStep(step_number=0, mode=StepMode.QUIZ, concept_id=C1_ID, concept_name="Derivatives", difficulty="medium"),
            SessionStep(step_number=1, mode=StepMode.FEYNMAN, concept_id=C1_ID, concept_name="Derivatives", difficulty="medium"),
        ],
        current_step=0,
    )
    step = plan.steps[0]
    step.completed = True
    step.score = 0.95

    _apply_adaptive_rules(plan, step, 0.95)

    assert plan.steps[1].difficulty == "hard"


def test_streak_advances_difficulty():
    plan = SessionPlan(
        user_id=uuid4(),
        intent=SessionIntent.DEEP_SESSION,
        steps=[
            SessionStep(step_number=0, mode=StepMode.QUIZ, concept_id=C1_ID, concept_name="D", difficulty="easy", completed=True, score=0.8),
            SessionStep(step_number=1, mode=StepMode.QUIZ, concept_id=C1_ID, concept_name="D", difficulty="easy", completed=True, score=0.8),
            SessionStep(step_number=2, mode=StepMode.QUIZ, concept_id=C1_ID, concept_name="D", difficulty="easy"),
            SessionStep(step_number=3, mode=StepMode.QUIZ, concept_id=C1_ID, concept_name="D", difficulty="medium"),
        ],
        current_step=2,
    )
    step = plan.steps[2]
    step.completed = True
    step.score = 0.8

    _apply_adaptive_rules(plan, step, 0.8)

    assert plan.steps[3].difficulty == "hard"


# ── Difficulty mapping ──────────────────────────────────────────


def test_mastery_to_difficulty():
    assert _mastery_to_difficulty(0.1) == "easy"
    assert _mastery_to_difficulty(0.5) == "medium"
    assert _mastery_to_difficulty(0.75) == "hard"
    assert _mastery_to_difficulty(0.9) == "expert"


def test_raise_difficulty():
    assert _raise_difficulty("easy") == "medium"
    assert _raise_difficulty("hard") == "expert"
    assert _raise_difficulty("expert") == "expert"


# ── Full 8-step adaptive scenario (acceptance test) ─────────────


def test_8_step_adaptive_session():
    """Simulated 8-step session that exercises all adaptive rules."""
    plan = SessionPlan(
        user_id=uuid4(),
        intent=SessionIntent.DEEP_SESSION,
        steps=[
            SessionStep(step_number=0, mode=StepMode.DIAGNOSE, concept_id=C1_ID, concept_name="Derivatives", difficulty="medium"),
            SessionStep(step_number=1, mode=StepMode.DIAGNOSE, concept_id=C2_ID, concept_name="Integrals", difficulty="medium"),
            SessionStep(step_number=2, mode=StepMode.TEACH, concept_id=C1_ID, concept_name="Derivatives", difficulty="easy"),
            SessionStep(step_number=3, mode=StepMode.QUIZ, concept_id=C1_ID, concept_name="Derivatives", difficulty="medium"),
            SessionStep(step_number=4, mode=StepMode.QUIZ, concept_id=C2_ID, concept_name="Integrals", difficulty="medium"),
            SessionStep(step_number=5, mode=StepMode.FEYNMAN, concept_id=C1_ID, concept_name="Derivatives", difficulty="medium"),
            SessionStep(step_number=6, mode=StepMode.BLURTING, concept_id=C2_ID, concept_name="Integrals", difficulty="medium"),
            SessionStep(step_number=7, mode=StepMode.REVIEW, concept_id=C1_ID, concept_name="Review"),
        ],
        current_step=0,
    )

    # Step 0: diagnose Derivatives — wrong → should re-teach
    plan.steps[0].completed = True
    plan.steps[0].score = 0.3
    _apply_adaptive_rules(plan, plan.steps[0], 0.3)
    assert any(s.mode == StepMode.TEACH and s.concept_id == C1_ID and s.difficulty == "easy"
               for s in plan.steps[8:] if len(plan.steps) > 8)

    # Step 3: quiz Derivatives — correct
    plan.current_step = 3
    plan.steps[3].completed = True
    plan.steps[3].score = 0.9
    _apply_adaptive_rules(plan, plan.steps[3], 0.9)

    # Step 4: quiz Integrals — wrong → should add remediation
    plan.current_step = 4
    steps_before = len(plan.steps)
    plan.steps[4].completed = True
    plan.steps[4].score = 0.2
    _apply_adaptive_rules(plan, plan.steps[4], 0.2)
    assert len(plan.steps) > steps_before

    # Verify the plan adapted: has remediation steps for weak concepts
    remediation = [s for s in plan.steps if not s.completed and s.difficulty == "easy"]
    assert len(remediation) >= 1

    # Verify summary can be generated
    from app.services.orchestrator import _finish_session
    plan.current_step = len(plan.steps)
    response = _finish_session(plan)
    assert response.done
    assert response.summary is not None
    assert response.summary.total_steps == len(plan.steps)
