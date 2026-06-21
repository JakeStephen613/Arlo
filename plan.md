# Arlo Rebuild Plan — Real Tutoring Engine + Captivating, Sleek UX

> **Purpose:** A staged prompt/spec to rebuild Arlo into a tool that genuinely *tutors* — it
> tracks how each student is doing, adapts, and makes studying feel focused and motivating — and
> *looks* like a real, hand-crafted product, not AI slop. Do the steps **in order**: backend
> logic (steps 1–6), then UX (steps 7–11). Each step lists Objective → Deliverables → Acceptance.
> Don't move on until a step's acceptance criteria pass.

## Context: what's wrong today (read before starting)

- **Context is shallow & barely used.** `app/services/context.py` stores a flat blob; every mode
  injects a single line — `"Focus on these concepts: {weak_areas[:3]}"`. The tutor never really
  sees how the student is doing.
- **Confidence is guessed, not measured.** `LearningEvent.confidence` defaults to `0.5`; mastery
  is never derived from actual answer correctness, so "weak areas" are mostly noise.
- **Modes are siloed.** flashcards / quiz / feynman / blurting / teaching / review_sheet each run
  independently — no shared session, no progression, no "what should I do next."
- **Teaching is a static wall of text.** `teaching.py` returns one non-streamed blob: it lands all
  at once after a long wait, isn't chunked, has no checkpoints, and you can't interact mid-lesson.
- **No engagement loop.** No goals, streaks, momentum, sense of progress, or reason to come back.
- **Navigation is mode-soup.** The student picks tools from a menu; nothing guides them.
- **Not concurrency-safe.** `context_cache`, `synthesis_locks`, `last_gpt_synthesis` are
  module-global dicts that diverge across Render workers. Postgres must be the source of truth.
- **LLM is Claude Haiku** via `app/services/llm.py` (OpenAI-shaped adapter, non-streaming). Keep
  Haiku; add streaming; prefer deterministic logic wherever the math can be exact.

## Learning-science principles (the backbone — apply in every step)

These are *why* the rebuild works, not decoration. Bake them into the orchestrator and the UX:
- **Active recall over passive review.** Default to retrieval (quiz/blurting/Feynman); reading is
  the setup, not the study.
- **Spaced repetition.** Resurface concepts as memory decays (Step 2 schedule), not on a fixed loop.
- **Interleaving.** Mix related concepts within a session rather than massing one at a time.
- **Desirable difficulty + scaffolding/fading.** Start with support, remove it as mastery rises;
  keep items in the productive-struggle zone (not too easy, not crushing).
- **Immediate, specific feedback.** Grade fast and tell the student *why*, not just right/wrong.
- **Metacognition.** Ask "how confident?" before revealing answers; compare felt vs. actual mastery.
- **Momentum & motivation.** Visible progress, short wins, and a clear "next" keep students going.

---

## STEP 1 — Learner model & schema

**Objective:** Replace the flat context blob with a principled, per-concept learner model that is
the backbone of all tutoring.

**Deliverables**
- A concept/skill model: each tracked item has `concept_id`, `name`, `topic`, optional prerequisite
  edges (a lightweight concept graph), and a `mastery_state`.
- New Supabase tables (SQL migration in `backend/migrations/`): `concepts`, `learner_concept_state`
  (per user × concept: mastery, last_seen, review schedule, attempt counts), `attempts` (immutable
  log of every graded interaction: user, concept, mode, signal, score, latency, timestamp), and
  `sessions` (a study session: user, started/ended, plan, goal, outcomes).
- Pydantic models in `app/models/`.

**Acceptance:** Migration applies cleanly; indexes on `user_id`, `concept_id`, `next_review`,
`session_id`. No module-global mutable state is the source of truth anymore.

## STEP 2 — Mastery + scheduling engine (deterministic, tested)

**Objective:** Turn real performance into a defensible mastery estimate and review schedule — no
LLM in the hot path.

**Deliverables**
- `app/services/mastery.py`: each `attempt` → a mastery update via a documented method (Bayesian
  Knowledge Tracing **or** Elo/Glicko) — pick one, justify in a docstring. Mastery ∈ [0,1] with an
  uncertainty term.
- Spaced repetition (SM-2 or FSRS-lite) driving `next_review`, with decay so stale concepts resurface.
- An **item-difficulty / selection** helper so the orchestrator can pick items in the
  productive-struggle zone (target ~70–85% success).
- Pure functions, fully unit-tested (`backend/tests/test_mastery.py`).

**Acceptance:** `pytest` green; correct answers raise mastery, wrong lower it, intervals expand
with success, weak/overdue concepts sort first. Zero network calls in the engine.

## STEP 3 — Tutor-briefing service (one source of truth, rich propagation)

**Objective:** Replace the one-line context injection with a structured "tutor briefing" every mode
consumes, plus a standard way every mode reports a graded result back.

**Deliverables**
- `app/services/learner_context.py` (supersedes `context.py`): builds a typed `TutorBriefing` —
  current focus, top weak concepts (with mastery %), due reviews, recent trajectory ("improving on
  X, struggling with Y"), and learning preferences.
- A single `record_attempt()` entry point all modes call (feeds Step 2).
- Postgres-backed with a short, **per-request** cache only (no cross-request global dicts).

**Acceptance:** `GET /api/learner/briefing` returns the briefing in <300ms warm; every mode can take
`TutorBriefing` as input and call `record_attempt()` on completion.

## STEP 4 — Session orchestrator: the tutoring brain (rethink how sessions work)

**Objective:** Stop making the student pick tools. Run a real, adaptive tutoring session built on
the learning-science principles above — this is the step that "makes a difference for the student."

**Deliverables**
- `app/services/orchestrator.py` + `app/routers/session.py`. A session is a **planned arc**, not a
  random tool: pick a goal (resume weak concepts, prep a topic, or clear due reviews), then run
  **diagnose → teach → practice (retrieval) → assess → review**, interleaving concepts.
- **Adaptivity rules (deterministic):** choose the next `{mode, concept(s), difficulty, rationale}`
  from mastery + schedule. Wrong answer → re-teach lighter + re-queue sooner; mastered → fade
  support and advance; repeated struggle → drop to a prerequisite concept; success streak →
  interleave something new. Keep items in the ~70–85% success band.
- **Session shapes:** offer a few intents — *Quick review* (5–10 min, due items only), *Learn
  something new* (teach + first practice), *Deep session* (full arc), and *Exam prep* (breadth +
  weak-area drilling). Each maps to an orchestrator config.
- **Metacognition + feedback hooks:** before revealing, ask confidence; after, surface the gap and
  a one-line "why." Emit a structured **end-of-session summary** (what improved, what's still weak,
  what's scheduled next, time on task).
- LLM (Haiku) only for qualitative bits (rationale phrasing, item generation); the *decision* of
  what to do next is deterministic.

**Acceptance:** A scripted 8-step session adapts: wrong answers re-queue and drop difficulty,
mastery advances and fades support, due reviews get pulled in, and a coherent summary is produced.
Covered by an integration test.

## STEP 5 — Streaming LLM layer (teaching streams in as it generates)

**Objective:** Make long generations — especially teaching — stream token-by-token instead of
landing as one delayed blob.

**Deliverables**
- Add a streaming path to `app/services/llm.py` (Anthropic `messages.stream`) exposing an async
  token generator alongside the existing one-shot call. Keep the OpenAI-shaped adapter for
  non-streaming callers.
- Server-Sent Events (SSE) endpoints (FastAPI `StreamingResponse`) for teaching and any long
  generation, emitting structured chunks (e.g. `{type: "token"|"section"|"checkpoint"|"done"}`) so
  the UI can render progressively and insert check-questions between sections.
- Backpressure/cancellation handling (client disconnect stops the stream) and a non-streaming
  fallback for clients/tests that don't consume SSE.

**Acceptance:** Hitting the teaching SSE endpoint streams tokens within ~1s of request and completes
incrementally; cancelling the request stops generation; a non-streaming fallback still returns full text.

## STEP 6 — Refactor every mode: consume briefing + grade + stream

**Objective:** Make each mode part of the loop, make confidence *measured*, and make teaching
genuinely captivating (not a wall of text).

**Deliverables**
- Rewrite quiz, flashcards, feynman_feedback, blurting, review_sheet to (1) take the `TutorBriefing`,
  (2) target specific concepts at a chosen difficulty, (3) **grade** the response into a real signal,
  (4) call `record_attempt()`. Add grading where missing (quiz = auto; Feynman/blurting = Haiku
  rubric 0–1 with justification).
- **Teaching rebuilt for engagement:** stream via Step 5; structure as **short chunked
  micro-lessons** with section headers, concrete analogies/examples, highlighted key facts, and an
  **inline check-question between sections** (retrieval, not passive). Support **"explain it
  differently / simpler / with an example"** and **follow-up questions mid-lesson** without leaving
  the flow. Pace for reading, not a dumped essay.
- Delete dead context paths and the global-dict synthesis machinery (replaced by Steps 2–3).
- Update `smoke_test.sh` + add `backend/tests/` coverage for each mode's grade→record path.

**Acceptance:** Completing any mode visibly moves the concept's mastery and reschedules it; teaching
streams in chunks with working check-questions and follow-ups; smoke + pytest green; no
`weak_areas[:3]` string-injection remains.

---

## STEP 7 — Design system: forest-green, restrained, hand-crafted

**Objective:** Kill the AI-slop look. Establish one cohesive system before touching screens.

**Deliverables**
- A **forest-green** palette with real depth (not one flat green): primary deep forest
  `#1F3D2B`/`#2E5339`, a brighter moss/sage accent for interactive states, warm off-white/cream
  surfaces in light mode (`#F7F5EF`), a near-black green-tinted base in dark mode. Define as CSS/
  Tailwind tokens (`--color-*`), never hardcoded hex.
- Typography with a point of view (a real pairing — humanist sans for UI + a characterful display
  face for headings; avoid Inter-on-white default). One type scale, generous line-height, one
  radius scale, one shadow scale, subtle borders over heavy cards.
- **Research references, don't invent blind:** study Linear, Vercel, Things 3, Stripe, and
  shadcn/ui + Radix for restraint, spacing, and motion. Capture 3–5 principles in `frontend/DESIGN.md`.
- Rebuild the component layer on shadcn/ui + Radix themed to the palette.

**Acceptance:** Tokens file + `DESIGN.md` exist; a "kit" page shows buttons, inputs, cards, badges,
charts in the new system; no purple gradients, no Inter-on-white, no clip-art emoji headers.

## STEP 8 — Navigation & app shell: make it effortless to use

**Objective:** Replace mode-soup with an information architecture that guides the student and gets
out of the way.

**Deliverables**
- A clean app shell: persistent sidebar/top-nav with at most a few destinations (**Home /
  Session / Library / Progress**), clear active states, breadcrumbs where needed.
- **Keyboard-first ergonomics:** a command palette (⌘K) to jump anywhere or start a session,
  keyboard shortcuts for answering/advancing within a session, and visible focus states.
- **Frictionless entry:** the primary action everywhere is "Start session — next: …"; no hunting
  through tools. Fast routing, preserved scroll, no full-page reloads between steps.

**Acceptance:** A new user can start studying in ≤2 clicks or one ⌘K; every destination is reachable
by keyboard; nothing requires "figuring out the menu."

## STEP 9 — Dashboard / Home: visualize the learner model (recruiter wow-piece)

**Objective:** Make the tutoring intelligence *visible* and motivating.

**Deliverables**
- A home dashboard surfacing the learner model: a mastery map/heatmap by concept, due-reviews
  count, **streak and momentum**, recent trajectory, and a single prominent **"Start session —
  next: …"** CTA wired to the orchestrator. Clean data-viz (sparingly colored, legible), not
  gauge-clutter.

**Acceptance:** Reads real data from briefing/orchestrator endpoints; empty and populated states
both look intentional and motivating.

## STEP 10 — The guided session experience + captivating teaching

**Objective:** Make the session itself the product — focused, fast, and engaging — with teaching
that holds attention.

**Deliverables**
- One **focus-mode** session view that runs the orchestrator arc, advancing through steps with a
  slim progress indicator, the "why this next" rationale, and **mastery moving in real time** after
  each answer. Mode UIs (quiz card, Feynman editor, flashcard, blurting) are *steps inside* the
  session, not separate destinations.
- **Captivating teaching UI:** stream text in with a smooth typewriter/section reveal (Step 5 SSE);
  render chunked micro-lessons with headers and highlighted key facts; surface inline
  check-questions between sections; a persistent "ask a follow-up / explain differently" affordance;
  pacing/▶ controls; copy/keep-to-notes. Never a single wall of text.
- **Engagement loop:** short wins and micro-feedback after each item, confidence prompts, an
  end-of-session summary screen (improved / still weak / scheduled next / time on task) with a clear
  "continue tomorrow / start another."

**Acceptance:** A user completes a full adaptive session end-to-end; teaching streams and is
interactive; mastery updates visibly; the summary makes the student want to return. Feels like one
coherent app, not separate tools.

## STEP 11 — Polish, states, accessibility, deploy

**Objective:** Ship-quality finish.

**Deliverables**
- Functional motion (Radix/Framer) for transitions and feedback — subtle, never decorative.
- Real loading / streaming / empty / error states everywhere; fully responsive; keyboard +
  screen-reader accessible (focus, ARIA, AA contrast on the green palette); dark-mode parity.
- Final QA, update README screenshots, redeploy backend + frontend on Render, verify the full loop
  (including streaming) in production.

**Acceptance:** Lighthouse/contrast pass; no dead states; production smoke test of a full streamed
session succeeds; README shows the new UI.

---

### Guiding principles throughout
- **No new environment variables or external services.** Code-and-migration changes only. Reuse the
  existing `ANTHROPIC_API_KEY` and `SUPABASE_*` credentials — the new tables live in the same
  Supabase project, so deploying needs zero Render/Supabase/Anthropic config changes beyond running
  the SQL migration. If a step seems to need a new secret or service, stop and find a way that doesn't.
- **Active recall first, spacing + interleaving always.** The session is built on the learning-science
  principles above, not on letting the student passively pick tools.
- **Deterministic where possible, LLM where it adds judgment.** Mastery math, scheduling, and the
  next-step decision are exact and tested; Haiku handles generation, grading rubrics, and phrasing.
- **Stream long generations.** Teaching and any long output should render progressively, never as a
  delayed blob.
- **Postgres is the source of truth.** No cross-request global mutable state.
- **Effortless + motivating.** ≤2 clicks (or ⌘K) to start; visible progress, momentum, and a clear
  "next" on every screen.
- **One accent, content-first, restraint over decoration.** If it looks like a template, redo it.
- **Every mode reads the learner model and writes back a measured signal** — the single rule that
  turns Arlo from a toy into a tutor.
