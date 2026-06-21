from fastapi import APIRouter, HTTPException, Request
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
