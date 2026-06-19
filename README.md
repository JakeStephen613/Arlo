# Arlo — AI Study Tutor

An AI-powered study session generator. Enter a topic or upload notes, get a
personalized study plan with flashcards, Feynman technique, quiz, and blurting exercises.

## Architecture

```
Browser → React/Vite (Supabase auth) → FastAPI backend → OpenAI API + Supabase DB
```

## Local Setup

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn main:app --port 10000 --reload

# Frontend
cd frontend
npm install
cp .env.example .env.local   # fill in keys
npm run dev
```

## Tech

- **Backend:** Python, FastAPI, OpenAI API (structured outputs)
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Auth & DB:** Supabase (Postgres + Row Level Security)
