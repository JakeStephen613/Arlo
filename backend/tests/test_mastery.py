"""Tests for the mastery + scheduling engine.

All tests are pure — zero network calls, zero database access.
"""

from datetime import datetime, timedelta, timezone

from app.services.mastery import (
    BKTParams,
    MasteryState,
    concept_priority_score,
    is_in_struggle_zone,
    schedule_review,
    select_items,
    update_mastery,
)

NOW = datetime(2026, 6, 21, 12, 0, 0, tzinfo=timezone.utc)


# ── Mastery goes up on correct answers ──────────────────────────


def test_correct_answer_raises_mastery():
    state = MasteryState()
    result = update_mastery(state, score=1.0, now=NOW)
    assert result.mastery > 0.0


def test_multiple_correct_answers_raise_mastery_monotonically():
    state = MasteryState()
    prev_mastery = 0.0
    for _ in range(5):
        result = update_mastery(state, score=1.0, now=NOW)
        assert result.mastery > prev_mastery
        prev_mastery = result.mastery
        state = MasteryState(
            mastery=result.mastery,
            uncertainty=result.uncertainty,
            attempt_count=state.attempt_count + 1,
            correct_count=state.correct_count + 1,
            streak=result.streak,
            last_seen=NOW,
        )


# ── Mastery goes down on wrong answers ──────────────────────────


def test_wrong_answer_lowers_mastery():
    state = MasteryState(mastery=0.6, attempt_count=5, correct_count=3, streak=2, last_seen=NOW)
    result = update_mastery(state, score=0.0, now=NOW)
    assert result.mastery < 0.6


def test_wrong_answer_resets_streak():
    state = MasteryState(mastery=0.5, attempt_count=3, streak=3, last_seen=NOW)
    result = update_mastery(state, score=0.0, now=NOW)
    assert result.streak == 0


# ── Intervals expand with success ───────────────────────────────


def test_intervals_expand_with_streak():
    r1 = schedule_review(mastery=0.5, streak=1, correct=True, now=NOW)
    r2 = schedule_review(mastery=0.5, streak=3, correct=True, now=NOW)
    r3 = schedule_review(mastery=0.5, streak=5, correct=True, now=NOW)
    assert r2 > r1
    assert r3 > r2


def test_wrong_answer_gives_short_interval():
    short = schedule_review(mastery=0.5, streak=0, correct=False, now=NOW)
    long = schedule_review(mastery=0.5, streak=3, correct=True, now=NOW)
    assert short < long


# ── Weak/overdue concepts sort first ────────────────────────────


def test_overdue_concept_has_higher_priority():
    overdue = concept_priority_score(
        mastery=0.5, uncertainty=0.5,
        next_review=NOW - timedelta(days=3), now=NOW,
    )
    not_due = concept_priority_score(
        mastery=0.5, uncertainty=0.5,
        next_review=NOW + timedelta(days=3), now=NOW,
    )
    assert overdue > not_due


def test_low_mastery_concept_has_higher_priority():
    low = concept_priority_score(mastery=0.2, uncertainty=0.5, now=NOW)
    high = concept_priority_score(mastery=0.9, uncertainty=0.5, now=NOW)
    assert low > high


def test_select_items_returns_weakest_first():
    states = [
        MasteryState(mastery=0.9, uncertainty=0.1, attempt_count=10, streak=5),
        MasteryState(mastery=0.2, uncertainty=0.8, attempt_count=2, streak=0),
        MasteryState(mastery=0.5, uncertainty=0.5, attempt_count=5, streak=1),
    ]
    indices = select_items(states, n=2, now=NOW)
    assert indices[0] == 1  # lowest mastery first


# ── Struggle zone ───────────────────────────────────────────────


def test_struggle_zone():
    assert is_in_struggle_zone(0.75)
    assert not is_in_struggle_zone(0.3)
    assert not is_in_struggle_zone(0.95)


# ── Uncertainty decreases with attempts ─────────────────────────


def test_uncertainty_decreases_over_attempts():
    state = MasteryState()
    results = []
    for _ in range(6):
        r = update_mastery(state, score=1.0, now=NOW)
        results.append(r)
        state = MasteryState(
            mastery=r.mastery,
            uncertainty=r.uncertainty,
            attempt_count=state.attempt_count + 1,
            correct_count=state.correct_count + 1,
            streak=r.streak,
            last_seen=NOW,
        )
    assert results[-1].uncertainty < results[0].uncertainty


# ── Decay over time ─────────────────────────────────────────────


def test_mastery_decays_when_not_seen():
    state = MasteryState(
        mastery=0.8, attempt_count=10, correct_count=8, streak=4,
        last_seen=NOW - timedelta(days=30),
    )
    result = update_mastery(state, score=1.0, now=NOW)
    # Even with a correct answer, decayed mastery + BKT update should be
    # lower than if the student had just been seen
    fresh = MasteryState(
        mastery=0.8, attempt_count=10, correct_count=8, streak=4,
        last_seen=NOW,
    )
    fresh_result = update_mastery(fresh, score=1.0, now=NOW)
    assert result.mastery < fresh_result.mastery


# ── Edge cases ──────────────────────────────────────────────────


def test_zero_attempts_state():
    state = MasteryState()
    result = update_mastery(state, score=0.0, now=NOW)
    assert 0.0 <= result.mastery <= 1.0
    assert 0.0 < result.uncertainty <= 1.0


def test_mastery_stays_bounded():
    state = MasteryState()
    for _ in range(50):
        result = update_mastery(state, score=1.0, now=NOW)
        assert 0.0 <= result.mastery <= 1.0
        state = MasteryState(
            mastery=result.mastery,
            attempt_count=state.attempt_count + 1,
            correct_count=state.correct_count + 1,
            streak=result.streak,
            last_seen=NOW,
        )


def test_interval_bounded():
    review = schedule_review(mastery=1.0, streak=100, correct=True, now=NOW)
    max_allowed = NOW + timedelta(days=180, hours=1)
    assert review <= max_allowed
