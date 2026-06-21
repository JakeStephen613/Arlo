"""Mastery estimation and spaced-repetition scheduling engine.

Uses Bayesian Knowledge Tracing (BKT) for mastery estimation because it
naturally produces both a point estimate and an uncertainty term from a
sequence of binary-ish observations, which maps cleanly to our attempt
scores. The four BKT parameters (p_init, p_learn, p_guess, p_slip) are
set to well-studied defaults and can be per-concept later.

Scheduling uses a simplified FSRS-inspired algorithm: intervals expand
with consecutive successes and contract on failure, with a stability
factor that grows as mastery solidifies.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional


# --- BKT defaults (well-studied starting points) ---
DEFAULT_P_INIT = 0.1
DEFAULT_P_LEARN = 0.15
DEFAULT_P_GUESS = 0.25
DEFAULT_P_SLIP = 0.10

# --- Scheduling constants ---
MIN_INTERVAL_HOURS = 4
MAX_INTERVAL_DAYS = 180
BASE_INTERVAL_HOURS = 24
STABILITY_GROWTH = 2.0
LAPSE_DIVISOR = 3.0
MASTERY_THRESHOLD = 0.85

# --- Item selection constants ---
TARGET_SUCCESS_LOW = 0.70
TARGET_SUCCESS_HIGH = 0.85


@dataclass
class BKTParams:
    p_init: float = DEFAULT_P_INIT
    p_learn: float = DEFAULT_P_LEARN
    p_guess: float = DEFAULT_P_GUESS
    p_slip: float = DEFAULT_P_SLIP


@dataclass
class MasteryState:
    mastery: float = 0.0
    uncertainty: float = 1.0
    attempt_count: int = 0
    correct_count: int = 0
    streak: int = 0
    last_seen: Optional[datetime] = None
    next_review: Optional[datetime] = None


@dataclass
class MasteryUpdate:
    mastery: float
    uncertainty: float
    streak: int
    next_review: datetime


def _bkt_update(p_known: float, correct: bool, params: BKTParams) -> float:
    """Single BKT update step. Returns updated P(known)."""
    if correct:
        p_correct_given_known = 1.0 - params.p_slip
        p_correct_given_unknown = params.p_guess
        numerator = p_known * p_correct_given_known
        denominator = numerator + (1.0 - p_known) * p_correct_given_unknown
    else:
        p_incorrect_given_known = params.p_slip
        p_incorrect_given_unknown = 1.0 - params.p_guess
        numerator = p_known * p_incorrect_given_known
        denominator = numerator + (1.0 - p_known) * p_incorrect_given_unknown

    if denominator == 0:
        return p_known

    p_known_given_obs = numerator / denominator
    p_known_new = p_known_given_obs + (1.0 - p_known_given_obs) * params.p_learn
    return max(0.0, min(1.0, p_known_new))


def _score_to_correct(score: float) -> bool:
    return score >= 0.5


def _compute_uncertainty(attempt_count: int, streak: int, mastery: float) -> float:
    """Uncertainty decreases with more attempts and higher streaks.
    Stays higher when mastery is in the uncertain middle range."""
    if attempt_count == 0:
        return 1.0
    base = 1.0 / (1.0 + 0.5 * attempt_count)
    streak_factor = 1.0 / (1.0 + 0.2 * streak)
    mid_penalty = 1.0 + 2.0 * mastery * (1.0 - mastery)
    return max(0.05, min(1.0, base * streak_factor * mid_penalty))


def update_mastery(
    state: MasteryState,
    score: float,
    now: Optional[datetime] = None,
    params: Optional[BKTParams] = None,
) -> MasteryUpdate:
    """Process one attempt and return the new mastery state + next review time.

    Pure function — no side effects, no network calls.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    if params is None:
        params = BKTParams()

    correct = _score_to_correct(score)

    p_known = state.mastery if state.attempt_count > 0 else params.p_init
    # Apply decay if time has passed since last seen
    if state.last_seen is not None:
        days_elapsed = max(0.0, (now - state.last_seen).total_seconds() / 86400)
        if days_elapsed > 0:
            decay = math.exp(-0.05 * days_elapsed)
            p_known *= decay

    new_mastery = _bkt_update(p_known, correct, params)

    new_streak = (state.streak + 1) if correct else 0
    new_attempt_count = state.attempt_count + 1
    new_correct_count = state.correct_count + (1 if correct else 0)

    uncertainty = _compute_uncertainty(new_attempt_count, new_streak, new_mastery)

    next_review = schedule_review(
        mastery=new_mastery,
        streak=new_streak,
        correct=correct,
        now=now,
    )

    return MasteryUpdate(
        mastery=new_mastery,
        uncertainty=uncertainty,
        streak=new_streak,
        next_review=next_review,
    )


def schedule_review(
    mastery: float,
    streak: int,
    correct: bool,
    now: Optional[datetime] = None,
) -> datetime:
    """FSRS-lite scheduling. Returns the next review datetime."""
    if now is None:
        now = datetime.now(timezone.utc)

    if not correct:
        hours = max(MIN_INTERVAL_HOURS, BASE_INTERVAL_HOURS / LAPSE_DIVISOR)
        return now + timedelta(hours=hours)

    stability = max(1.0, STABILITY_GROWTH ** streak)
    mastery_bonus = mastery ** 2
    hours = BASE_INTERVAL_HOURS * stability * (0.5 + mastery_bonus)

    hours = max(MIN_INTERVAL_HOURS, min(hours, MAX_INTERVAL_DAYS * 24))
    return now + timedelta(hours=hours)


def concept_priority_score(
    mastery: float,
    uncertainty: float,
    next_review: Optional[datetime] = None,
    now: Optional[datetime] = None,
) -> float:
    """Higher score = should be studied sooner.

    Combines: overdue-ness, distance from productive-struggle zone,
    and uncertainty (less certain → more valuable to test).
    """
    if now is None:
        now = datetime.now(timezone.utc)

    overdue = 0.0
    if next_review is not None:
        hours_overdue = (now - next_review).total_seconds() / 3600
        overdue = max(0.0, hours_overdue) / 24.0

    target_mid = (TARGET_SUCCESS_LOW + TARGET_SUCCESS_HIGH) / 2.0
    zone_fit = 1.0 - abs(mastery - target_mid) / target_mid

    score = (
        0.4 * (1.0 - mastery)
        + 0.25 * overdue
        + 0.2 * uncertainty
        + 0.15 * max(0.0, zone_fit)
    )
    return max(0.0, min(1.0, score))


def select_items(
    states: list[MasteryState],
    n: int = 5,
    now: Optional[datetime] = None,
) -> list[int]:
    """Return indices of the top-n concepts to study, prioritizing
    items in the productive-struggle zone and overdue reviews."""
    if now is None:
        now = datetime.now(timezone.utc)

    scored = []
    for i, s in enumerate(states):
        priority = concept_priority_score(
            mastery=s.mastery,
            uncertainty=s.uncertainty,
            next_review=s.next_review,
            now=now,
        )
        scored.append((priority, i))

    scored.sort(reverse=True)
    return [i for _, i in scored[:n]]


def is_in_struggle_zone(mastery: float) -> bool:
    return TARGET_SUCCESS_LOW <= mastery <= TARGET_SUCCESS_HIGH
