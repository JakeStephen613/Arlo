# Arlo — Remaining Work

## Still To Do

### 1. Study streak always shows 0
- `learner_context.py` never computes `study_streak_days` — needs a query against `study_session_data` or `attempts` for consecutive days with activity
- Progress page displays it but it's always 0

### 2. Library page only shows weak/due concepts, not all
- `LibraryPage.tsx` heading says "All concepts" but only renders `weak_concepts` and `due_reviews` from briefing
- Mastered concepts are invisible — need an endpoint or briefing field for all concepts

### 3. Resume/continue a topic (not built)
- Each session is fire-and-forget — no "pick up where I left off"
- Needs session state persistence and a way to resume mid-curriculum

### 4. Assigned sessions (tutor → student) partially broken
- `Index.tsx` shows assigned sessions using old data model
- Assignment completion tracking depends on fragile topic string matching

### 5. Chatbot mode disconnected
- `backend/app/routers/chatbot.py` exists but no UI path reaches it
- Needs UX decision on where conversational tutoring fits

### 6. No learner onboarding or profile setup
- No way to set learning goals, subjects, grade level
- No initial assessment to calibrate starting mastery

### 7. Two Supabase client patterns (architecture)
- Some data through backend API, some directly from frontend to Supabase
- No consistent data access pattern

### 8. Database has orphaned tables
- `sessions` table (old orchestrator) no longer written to
- `attempts` table references old `sessions` table
- `learner_concept_state` has stale entries (General Knowledge filtered but not cleaned up)

### 9. `apiPostAnon` used without auth for sensitive endpoints
- `generateBedtimeReviewSheet` and `resetContext` send no auth headers
- `user_id` passed in body — any user could reset another's context
