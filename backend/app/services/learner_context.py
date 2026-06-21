"""Tutor-briefing service — the single source of truth every mode consumes.

Supersedes context.py. Builds a structured TutorBriefing from Postgres,
provides record_attempt() as the single entry point for all modes to
report graded results back into the learner model.

No cross-request global dicts. Per-request only.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.services.mastery import (
    MasteryState,
    MasteryUpdate,
    concept_priority_score,
    update_mastery,
)

logger = logging.getLogger(__name__)


# ── Briefing types ──────────────────────────────────────────────


class ConceptSnapshot(BaseModel):
    concept_id: UUID
    name: str
    topic: Optional[str] = None
    mastery: float = 0.0
    uncertainty: float = 1.0
    streak: int = 0
    next_review: Optional[datetime] = None
    priority: float = 0.0


class TrajectoryItem(BaseModel):
    concept_name: str
    direction: str  # "improving" | "struggling" | "stable"
    mastery: float


class TutorBriefing(BaseModel):
    user_id: UUID
    current_focus: Optional[str] = None
    weak_concepts: list[ConceptSnapshot] = Field(default_factory=list)
    due_reviews: list[ConceptSnapshot] = Field(default_factory=list)
    trajectory: list[TrajectoryItem] = Field(default_factory=list)
    total_concepts: int = 0
    average_mastery: float = 0.0
    study_streak_days: int = 0


class AttemptRecord(BaseModel):
    user_id: UUID
    concept_id: UUID
    session_id: Optional[UUID] = None
    mode: str
    score: float = Field(ge=0.0, le=1.0)
    latency_ms: Optional[int] = None
    metadata: dict = Field(default_factory=dict)


# ── Database helpers (Supabase) ─────────────────────────────────


def _get_supabase():
    from app.services.context import get_supabase
    return get_supabase()


def _fetch_learner_states(supabase, user_id: str) -> list[dict]:
    result = (
        supabase.table("learner_concept_state")
        .select("*, concepts(name, topic)")
        .eq("user_id", user_id)
        .execute()
    )
    return result.data or []


def _fetch_recent_attempts(supabase, user_id: str, limit: int = 20) -> list[dict]:
    result = (
        supabase.table("attempts")
        .select("*, concepts(name)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def _upsert_learner_state(
    supabase,
    user_id: str,
    concept_id: str,
    update: MasteryUpdate,
    attempt_count: int,
    correct_count: int,
    now: datetime,
) -> None:
    supabase.table("learner_concept_state").upsert(
        {
            "user_id": user_id,
            "concept_id": concept_id,
            "mastery": update.mastery,
            "uncertainty": update.uncertainty,
            "streak": update.streak,
            "next_review": update.next_review.isoformat(),
            "attempt_count": attempt_count,
            "correct_count": correct_count,
            "last_seen": now.isoformat(),
            "updated_at": now.isoformat(),
        },
        on_conflict="user_id,concept_id",
    ).execute()


def _insert_attempt(supabase, record: AttemptRecord, now: datetime) -> None:
    supabase.table("attempts").insert(
        {
            "id": str(uuid4()),
            "user_id": str(record.user_id),
            "concept_id": str(record.concept_id),
            "session_id": str(record.session_id) if record.session_id else None,
            "mode": record.mode,
            "score": record.score,
            "latency_ms": record.latency_ms,
            "metadata": record.metadata,
            "created_at": now.isoformat(),
        }
    ).execute()


# ── Public API ──────────────────────────────────────────────────


def get_tutor_briefing(user_id: str) -> TutorBriefing:
    """Build a TutorBriefing from current Postgres state."""
    now = datetime.now(timezone.utc)
    supabase = _get_supabase()

    rows = _fetch_learner_states(supabase, user_id)
    recent = _fetch_recent_attempts(supabase, user_id, limit=20)

    if not rows:
        return TutorBriefing(user_id=UUID(user_id))

    snapshots: list[ConceptSnapshot] = []
    for row in rows:
        concept_info = row.get("concepts", {}) or {}
        priority = concept_priority_score(
            mastery=row["mastery"],
            uncertainty=row["uncertainty"],
            next_review=(
                datetime.fromisoformat(row["next_review"])
                if row.get("next_review")
                else None
            ),
            now=now,
        )
        snapshots.append(
            ConceptSnapshot(
                concept_id=row["concept_id"],
                name=concept_info.get("name", "Unknown"),
                topic=concept_info.get("topic"),
                mastery=row["mastery"],
                uncertainty=row["uncertainty"],
                streak=row.get("streak", 0),
                next_review=(
                    datetime.fromisoformat(row["next_review"])
                    if row.get("next_review")
                    else None
                ),
                priority=priority,
            )
        )

    weak = sorted(
        [s for s in snapshots if s.mastery < 0.7],
        key=lambda s: s.mastery,
    )[:10]

    due = sorted(
        [s for s in snapshots if s.next_review and s.next_review <= now],
        key=lambda s: s.next_review,
    )[:10]

    # Trajectory from recent attempts
    trajectory = _build_trajectory(recent)

    avg_mastery = sum(s.mastery for s in snapshots) / len(snapshots) if snapshots else 0.0

    focus = weak[0].name if weak else (due[0].name if due else None)

    return TutorBriefing(
        user_id=UUID(user_id),
        current_focus=focus,
        weak_concepts=weak,
        due_reviews=due,
        trajectory=trajectory,
        total_concepts=len(snapshots),
        average_mastery=round(avg_mastery, 3),
    )


def record_attempt(record: AttemptRecord) -> MasteryUpdate:
    """Record a graded attempt: insert into attempts table, update learner state.

    This is the single entry point all modes call after grading.
    """
    now = datetime.now(timezone.utc)
    supabase = _get_supabase()

    _insert_attempt(supabase, record, now)

    # Fetch current state
    existing = (
        supabase.table("learner_concept_state")
        .select("*")
        .eq("user_id", str(record.user_id))
        .eq("concept_id", str(record.concept_id))
        .limit(1)
        .execute()
    )

    if existing.data:
        row = existing.data[0]
        state = MasteryState(
            mastery=row["mastery"],
            uncertainty=row["uncertainty"],
            attempt_count=row["attempt_count"],
            correct_count=row["correct_count"],
            streak=row.get("streak", 0),
            last_seen=(
                datetime.fromisoformat(row["last_seen"])
                if row.get("last_seen")
                else None
            ),
            next_review=(
                datetime.fromisoformat(row["next_review"])
                if row.get("next_review")
                else None
            ),
        )
    else:
        state = MasteryState()

    result = update_mastery(state, score=record.score, now=now)

    new_attempt_count = state.attempt_count + 1
    new_correct_count = state.correct_count + (1 if record.score >= 0.5 else 0)

    _upsert_learner_state(
        supabase,
        str(record.user_id),
        str(record.concept_id),
        result,
        new_attempt_count,
        new_correct_count,
        now,
    )

    return result


def ensure_concept(name: str, topic: Optional[str] = None) -> str:
    """Get or create a concept by name+topic, return its id."""
    supabase = _get_supabase()
    query = supabase.table("concepts").select("id").eq("name", name)
    if topic:
        query = query.eq("topic", topic)
    existing = query.limit(1).execute()

    if existing.data:
        return existing.data[0]["id"]

    result = supabase.table("concepts").insert(
        {"id": str(uuid4()), "name": name, "topic": topic}
    ).execute()
    return result.data[0]["id"]


# ── Helpers ─────────────────────────────────────────────────────


def _build_trajectory(recent_attempts: list[dict]) -> list[TrajectoryItem]:
    """Derive trajectory from recent attempts per concept."""
    by_concept: dict[str, list[float]] = {}
    for att in recent_attempts:
        concept_info = att.get("concepts", {}) or {}
        name = concept_info.get("name", "Unknown")
        by_concept.setdefault(name, []).append(att["score"])

    trajectory = []
    for name, scores in by_concept.items():
        if len(scores) < 2:
            continue
        recent_avg = sum(scores[: len(scores) // 2]) / max(1, len(scores) // 2)
        older_avg = sum(scores[len(scores) // 2 :]) / max(
            1, len(scores) - len(scores) // 2
        )
        diff = recent_avg - older_avg
        if diff > 0.1:
            direction = "improving"
        elif diff < -0.1:
            direction = "struggling"
        else:
            direction = "stable"
        trajectory.append(
            TrajectoryItem(concept_name=name, direction=direction, mastery=recent_avg)
        )
    return trajectory
