from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware import Middleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import jwt
import logging

from app.core.config import ALLOWED_ORIGINS, SUPABASE_JWT_SECRET, ENV, SUPABASE_URL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                decoded = jwt.decode(
                    token,
                    SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience="authenticated",
                )
                request.state.user = decoded
            except Exception as e:
                logger.warning("JWT decode failed: %s", e)
                from starlette.responses import JSONResponse
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid or expired token"},
                )
        else:
            request.state.user = {}
        return await call_next(request)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(middleware=[Middleware(AuthMiddleware)])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Modular routers ---
from app.routers.flashcards import router as flashcard_router
from app.routers.quiz import router as quiz_router
from app.routers.study_session import router as study_session_router
from app.routers.chatbot import router as chatbot_router
from app.routers.review_sheet import router as review_router
from app.routers.feynman_feedback import router as feynman_router
from app.routers.blurting import router as blurting_router
from app.services.context import router as context_router
from app.routers.pdf_parser import router as pdf_parser_router
from app.routers.teaching import router as teaching_router
from app.routers.session import router as session_router

# --- Include all routes ---
app.include_router(flashcard_router, prefix="/api")
app.include_router(quiz_router, prefix="/api/quiz")
app.include_router(study_session_router, prefix="/api")
app.include_router(chatbot_router, prefix="/api")
app.include_router(review_router, prefix="/api")
app.include_router(feynman_router, prefix="/api")
app.include_router(blurting_router, prefix="/api")
app.include_router(context_router, prefix="/api")
app.include_router(pdf_parser_router, prefix="/api")
app.include_router(teaching_router, prefix="/api")
app.include_router(session_router, prefix="/api")

@app.on_event("startup")
async def on_startup():
    startup_logger = logging.getLogger("arlo.startup")
    startup_logger.info("Starting Arlo backend | env=%s | supabase=%s", ENV, SUPABASE_URL)
    startup_logger.info("CORS allowed origins: %s", ALLOWED_ORIGINS)

# --- Root and health check ---
@app.get("/")
def root():
    return {"message": "ARLO backend is alive"}

@app.get("/ping")
def health_check():
    return {"status": "ok"}
