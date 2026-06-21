# Arlo — Remaining Work

## Step 1: Full Smoke Test (do this first next session)
**Ask the user for:** Anthropic API key (for env) + Arlo login credentials
**Then test every user-facing flow end-to-end:**

### Session Flow
- [ ] Enter a topic → generate study plan → verify plan renders with blocks
- [ ] Start studying → teaching lesson streams and renders section-by-section
- [ ] Inline check questions appear and grade correctly (partial credit works)
- [ ] Each technique mode loads after teaching: quiz, flashcard, feynman, blurting
- [ ] Quiz: questions are thoughtful, options are plausible, grading works client-side
- [ ] Flashcard: card flips, self-rating records to backend `/flashcards/review`
- [ ] Feynman: submit explanation → get meaningful feedback with score
- [ ] Blurting: exercises are specific to content, feedback identifies mentioned/missed
- [ ] Session completes → SummaryView shows → session data saved to `study_session_data`
- [ ] PDF upload: upload a PDF → content parsed → plan generated from it

### Navigation & Pages
- [ ] Homepage loads without errors, shows useful content
- [ ] Progress page loads: mastery bars, trajectory, session history, review sheets expand
- [ ] "Review now" button on due concepts navigates to Session with prefilled topic
- [ ] Library page loads and shows concepts (check if only weak/due or all)
- [ ] Tutor link hidden for students, visible for tutors
- [ ] All sidebar nav links work

### Auth
- [ ] Login/signup works
- [ ] Invalid JWT returns 401 (not silent pass-through)
- [ ] Authenticated requests include proper headers

### Buttons & Interactions
- [ ] Every visible button does something (no dead buttons)
- [ ] Error states show retry options that actually work
- [ ] Teaching retry button re-streams content
- [ ] Back buttons navigate correctly

---

## Known Issues (fix after smoke test)

### 1. Study streak always shows 0
- `learner_context.py` never computes `study_streak_days`
- Needs query against `study_session_data` for consecutive days with activity

### 2. Library page only shows weak/due concepts, not all
- Mastered concepts invisible — need endpoint or briefing field for all concepts

### 3. Resume/continue a topic (not built)
- No "pick up where I left off" — needs session state persistence

### 4. Assigned sessions (tutor → student) partially broken
- Old data model on Index.tsx, fragile topic string matching

### 5. Chatbot mode disconnected
- Backend exists, no UI path reaches it

### 6. No learner onboarding or profile setup
- No learning goals, grade level, initial assessment

### 7. Two Supabase client patterns (architecture)
- Inconsistent data access (some via backend API, some direct from frontend)

### 8. Database has orphaned tables
- `sessions` table unused, `attempts` references old `sessions`, stale entries

### 9. `apiPostAnon` sends no auth for sensitive endpoints
- `generateBedtimeReviewSheet` and `resetContext` have no JWT — security issue
