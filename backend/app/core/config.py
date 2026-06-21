import os
from dotenv import load_dotenv

load_dotenv()

# Required — raises KeyError at startup if missing (better than failing at first request)
ANTHROPIC_API_KEY: str = os.environ["ANTHROPIC_API_KEY"]
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE: str = os.environ["SUPABASE_SERVICE_ROLE"]
SUPABASE_JWT_SECRET: str = os.environ["SUPABASE_JWT_SECRET"]

# Optional with defaults
ENV: str = os.getenv("ENV", "production")
CONTEXT_API_BASE: str = os.getenv("CONTEXT_API_BASE", "http://localhost:10000")
ALLOWED_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
