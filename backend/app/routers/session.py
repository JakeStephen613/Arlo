from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import logging

from app.services.learner_context import get_tutor_briefing, TutorBriefing

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_user_id(request: Request) -> str:
    if request.headers.get("x-user-id"):
        return request.headers["x-user-id"]
    user = getattr(request.state, "user", {})
    uid = user.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


@router.get("/learner/briefing", response_model=TutorBriefing)
async def briefing(request: Request):
    user_id = _get_user_id(request)
    return get_tutor_briefing(user_id)


@router.get("/learner/mastery-history")
async def mastery_history(request: Request):
    """Return attempt history grouped by concept for trend visualization."""
    user_id = _get_user_id(request)
    try:
        from app.services.context import get_supabase
        supabase = get_supabase()

        result = supabase.table("attempts").select(
            "concept_id, score, mode, created_at, concepts(name, topic)"
        ).eq("user_id", user_id).order("created_at", desc=False).limit(500).execute()

        rows = result.data or []

        by_concept: dict[str, list] = {}
        for row in rows:
            cinfo = row.get("concepts") or {}
            name = cinfo.get("name", "Unknown")
            if name == "General Knowledge":
                continue
            by_concept.setdefault(name, []).append({
                "score": row["score"],
                "mode": row["mode"],
                "date": row["created_at"],
            })

        concepts = []
        for name, attempts in by_concept.items():
            scores = [a["score"] for a in attempts]
            concepts.append({
                "name": name,
                "attempts": attempts,
                "current_score": scores[-1] if scores else 0,
                "trend": _calc_trend(scores),
                "total_attempts": len(attempts),
            })

        # Study calendar: sessions per day for last 90 days
        sessions_result = supabase.table("study_session_data").select(
            "created_at, duration_minutes"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(180).execute()

        calendar: dict[str, dict] = {}
        for row in (sessions_result.data or []):
            ts = row.get("created_at") or row.get("timestamp")
            if ts:
                day = datetime.fromisoformat(ts).strftime("%Y-%m-%d")
                if day not in calendar:
                    calendar[day] = {"date": day, "sessions": 0, "minutes": 0}
                calendar[day]["sessions"] += 1
                calendar[day]["minutes"] += row.get("duration_minutes", 0)

        return {
            "concepts": sorted(concepts, key=lambda c: c["current_score"]),
            "calendar": sorted(calendar.values(), key=lambda d: d["date"]),
        }
    except Exception as e:
        logger.exception("Failed to get mastery history")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/learner/due-reviews")
async def due_reviews(request: Request):
    """Return concepts due for spaced repetition review."""
    user_id = _get_user_id(request)
    try:
        from app.services.context import get_supabase
        supabase = get_supabase()
        now = datetime.now(timezone.utc).isoformat()

        result = supabase.table("learner_concept_state").select(
            "*, concepts(name, topic)"
        ).eq("user_id", user_id).lte("next_review", now).order("next_review").limit(20).execute()

        items = []
        for row in (result.data or []):
            cinfo = row.get("concepts") or {}
            name = cinfo.get("name", "Unknown")
            if name == "General Knowledge":
                continue
            items.append({
                "concept_id": row["concept_id"],
                "name": name,
                "topic": cinfo.get("topic"),
                "mastery": row["mastery"],
                "uncertainty": row["uncertainty"],
                "streak": row.get("streak", 0),
                "next_review": row.get("next_review"),
                "last_seen": row.get("last_seen"),
                "attempt_count": row.get("attempt_count", 0),
            })

        return {"items": items, "total_due": len(items)}
    except Exception as e:
        logger.exception("Failed to get due reviews")
        raise HTTPException(status_code=500, detail=str(e))


def _calc_trend(scores: list[float]) -> str:
    if len(scores) < 2:
        return "stable"
    half = len(scores) // 2
    recent = sum(scores[:half]) / max(1, half)
    older = sum(scores[half:]) / max(1, len(scores) - half)
    diff = recent - older
    if diff > 0.1:
        return "improving"
    elif diff < -0.1:
        return "struggling"
    return "stable"
