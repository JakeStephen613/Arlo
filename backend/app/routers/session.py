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


# ── Active session state (server-side persistence) ─────────────


@router.get("/session-state")
async def get_session_state(request: Request):
    """Load the user's active session state (replaces localStorage)."""
    user_id = _get_user_id(request)
    try:
        from app.services.context import get_supabase
        sb = get_supabase()
        result = sb.table("active_session_state").select("session_data, updated_at").eq("user_id", user_id).maybeSingle().execute()
        if result.data:
            return {"state": result.data["session_data"], "updated_at": result.data["updated_at"]}
        return {"state": None}
    except Exception as e:
        logger.exception("Failed to load session state")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/session-state")
async def save_session_state(request: Request):
    """Save (upsert) the user's active session state."""
    user_id = _get_user_id(request)
    body = await request.json()
    session_data = body.get("state")
    if session_data is None:
        raise HTTPException(status_code=400, detail="Missing 'state' field")
    try:
        from app.services.context import get_supabase
        sb = get_supabase()
        now = datetime.now(timezone.utc).isoformat()
        sb.table("active_session_state").upsert({
            "user_id": user_id,
            "session_data": session_data,
            "updated_at": now,
        }, on_conflict="user_id").execute()
        return {"ok": True}
    except Exception as e:
        logger.exception("Failed to save session state")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/session-state")
async def clear_session_state(request: Request):
    """Clear the user's active session state."""
    user_id = _get_user_id(request)
    try:
        from app.services.context import get_supabase
        sb = get_supabase()
        sb.table("active_session_state").delete().eq("user_id", user_id).execute()
        return {"ok": True}
    except Exception as e:
        logger.exception("Failed to clear session state")
        raise HTTPException(status_code=500, detail=str(e))


# ── Review session generation ──────────────────────────────────


@router.post("/learner/start-review")
async def start_review_session(request: Request):
    """Generate a mixed-mode review session from due concepts."""
    user_id = _get_user_id(request)
    try:
        from app.services.context import get_supabase
        sb = get_supabase()
        now = datetime.now(timezone.utc).isoformat()

        result = sb.table("learner_concept_state").select(
            "concept_id, mastery, streak, attempt_count, concepts(name, topic)"
        ).eq("user_id", user_id).lte("next_review", now).order("next_review").limit(10).execute()

        items = result.data or []
        if not items:
            return {"items": [], "message": "Nothing due for review right now!"}

        review_items = []
        for row in items:
            cinfo = row.get("concepts") or {}
            name = cinfo.get("name", "Unknown")
            if name == "General Knowledge":
                continue
            mastery = row.get("mastery", 0)
            if mastery < 0.4:
                mode = "flashcard"
            elif mastery < 0.7:
                mode = "quiz"
            else:
                mode = "feynman"
            review_items.append({
                "concept_id": row["concept_id"],
                "name": name,
                "topic": cinfo.get("topic"),
                "mastery": mastery,
                "mode": mode,
                "streak": row.get("streak", 0),
            })

        return {"items": review_items, "total": len(review_items)}
    except Exception as e:
        logger.exception("Failed to generate review session")
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
