# Completed Fixes

## Critical Bugs
- **Study plan generation crash** — replaced nonexistent `client.responses.parse()` with `call_messages()` + JSON schema
- **Quiz grading always 0%** — `GradeRequest` now accepts correct answers, compares properly
- **Auth middleware silent fail** — returns 401 on invalid JWT instead of passing empty user through
- **AppShell crash** — `userProfile` was used in `SidebarContent` without being passed as prop (runtime ReferenceError)

## UX / Logic Fixes
- **Tutor nav visible to students** — filtered to `account_mode === 'tutor'` only
- **Stale "General Knowledge" concepts** — filtered out in `learner_context.py`
- **Teaching retry button broken** — added `retryCount` to useEffect deps so stream restarts
- **SessionComplete double-fires** — removed duplicate `useEffect` that called `executeStep(0)` twice

## Features Connected
- **Session data never saved** — `SummaryView` now calls `saveStudySessionData()` on mount
- **PDF upload in session flow** — added upload button to `TopicInput`, wires through `/pdf/parse` → `parsed_summary`
- **Session history for students** — Progress page shows last 10 sessions with expandable review sheets
- **Review sheet access** — clickable session rows show saved review sheets inline
- **Flashcard reviews recorded** — self-rating now calls `/flashcards/review` to update mastery
- **Spaced repetition actionable** — "Review now" button on due concepts navigates to Session with prefilled topic
