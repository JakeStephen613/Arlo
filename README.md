# Arlo — AI Study Tutor

An AI-powered study session generator. Enter a topic or upload notes, get a
personalized study plan with flashcards, Feynman technique, quiz, and blurting exercises.

## Architecture

```
Browser → React/Vite (Supabase auth) → FastAPI backend → Anthropic Claude API + Supabase DB
```

### Backend layout

```
backend/
├── app/
│   ├── main.py            # FastAPI app, middleware, router wiring
│   ├── core/
│   │   └── config.py      # env-driven settings
│   ├── services/
│   │   ├── llm.py         # Anthropic (Claude) client
│   │   └── context.py     # shared learning-context service
│   └── routers/           # one module per feature endpoint
│       ├── flashcards.py  quiz.py  study_session.py  chatbot.py
│       ├── review_sheet.py  feynman_feedback.py  blurting.py
│       └── pdf_parser.py  teaching.py
└── requirements.txt
```

## Local Setup

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn app.main:app --port 10000 --reload

# Frontend
cd frontend
npm install
cp .env.example .env.local   # fill in keys
npm run dev
```

## Tech

- **Backend:** Python, FastAPI, Anthropic Claude API (structured outputs)
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Auth & DB:** Supabase (Postgres + Row Level Security)
