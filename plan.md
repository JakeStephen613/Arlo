# Arlo Cleanup Plan

**Goal:** Interview-ready, production-quality code. Clean, concise, working. No AI slop.

**Stack:** FastAPI (Python) backend + React/TypeScript/Vite frontend + Supabase (auth + DB) + OpenAI API

**Repo layout:**
```
/Users/jakestephen/Documents/GitHub/Arlo/
  backend/     ← FastAPI. Entrypoint: main.py. Run: uvicorn main:app --port 10000 --reload
  frontend/    ← React/Vite. Run: npm run dev  (port 5173)
  plan.md
```

**How to use this plan:** Each phase is fully self-contained. Complete every step and tick every checkbox before stopping. Memory is cleared between phases — only this file is needed to resume.

**Definition of AI slop to eliminate:**
- Duplicate type definitions / utility functions copied file-to-file
- Emoji-heavy print statements masquerading as logging
- Debug components and dead files committed alongside prod code
- Hardcoded URLs, keys, and platform-specific strings (Lovable/Render)
- `any` TypeScript types and unenforced Pydantic fields
- Near-identical components that should share a base
- Inline Tailwind class strings over ~6 utilities long (extract with `cn()` or Tailwind `@apply`)
- Redundant comments that describe what the code clearly already says
- Parallel duplicate files (`studyModulesApiFixed.ts`, `teaching_enhanced.py`)
- Over-engineered prompts / comments that are 300 lines of emoji-decorated instructions

---

## Phase 1: Dead Code Removal & Project Infrastructure

**Goal:** Remove all junk, establish .env pattern. Zero feature work.

### 1.1 Delete dead backend files

```bash
cd /Users/jakestephen/Documents/GitHub/Arlo/backend
rm YouTube.py   # empty file — 1 line, nothing in it
rm app.py       # empty file — real app is main.py
rm delete       # empty file with no extension, accidental commit
```

### 1.2 Backend `.env.example`

Create `backend/.env.example`:
```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
YOUTUBE_API_KEY=your-youtube-api-key
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
ENV=dev
CONTEXT_API_BASE=http://localhost:10000
```

Copy to `backend/.env` and fill in real values.

### 1.3 Frontend `.env.example`

Create `frontend/.env.example`:
```
VITE_API_BASE_URL=http://localhost:10000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Copy to `frontend/.env.local` and fill in real values (use the values currently hardcoded in `src/integrations/supabase/client.ts`).

### 1.4 Gitignores

`backend/.gitignore`:
```
.env
__pycache__/
*.pyc
.venv/
venv/
.DS_Store
```

Confirm `frontend/.gitignore` already has `.env.local` (Vite projects do by default — just verify).

Root `Arlo/.gitignore`:
```
.DS_Store
*.log
```

### 1.5 Verify

- [ ] `ls backend/` — no `YouTube.py`, `app.py`, or `delete`
- [ ] Both `.env.example` files exist
- [ ] `uvicorn main:app --port 10000 --reload` starts with no import errors
- [ ] `/ping` returns `{"status": "ok"}`

---

## Phase 2: Backend — Config & Security

**Goal:** Centralized config, no hardcoded URLs anywhere, JWT properly verified, CORS env-driven.

### 2.1 Create `backend/config.py`

Single source of truth. All other modules import from here instead of calling `os.getenv` directly.

```python
import os
from dotenv import load_dotenv

load_dotenv()

# Required — will raise KeyError at startup if missing (better than failing at first request)
OPENAI_API_KEY: str = os.environ["OPENAI_API_KEY"]
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE: str = os.environ["SUPABASE_SERVICE_ROLE"]
SUPABASE_JWT_SECRET: str = os.environ["SUPABASE_JWT_SECRET"]
YOUTUBE_API_KEY: str = os.environ["YOUTUBE_API_KEY"]

# Optional with defaults
ENV: str = os.getenv("ENV", "production")
CONTEXT_API_BASE: str = os.getenv("CONTEXT_API_BASE", "http://localhost:10000")
ALLOWED_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
```

### 2.2 Fix `main.py` — remove hardcoded Lovable CORS and load_dotenv

**Remove** the hardcoded origin list:
```python
# DELETE all of this:
allow_origins=[
    "https://id-preview--c4e79f71-1738-4330-9bbd-c1a1b1fea023.lovable.app",
    "https://c4e79f71-1738-4330-9bbd-c1a1b1fea023.lovableproject.com",
    "https://arlo-ai-tutor.lovable.app",
    "https://lovable.app",
    "http://localhost:10000",
    "https://lovable.dev",
],
```

**Replace** with:
```python
from config import ALLOWED_ORIGINS
# ...
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
```

Also remove `load_dotenv()` from `main.py` — `config.py` handles it.

### 2.3 Fix JWT verification in `main.py`

**Current (insecure):**
```python
decoded = jwt.decode(token, options={"verify_signature": False})
```
This accepts any token, including forged ones.

**Fix:**
```python
from config import SUPABASE_JWT_SECRET

decoded = jwt.decode(
    token,
    SUPABASE_JWT_SECRET,
    algorithms=["HS256"],
    audience="authenticated",
)
```

The JWT secret is in Supabase dashboard → Settings → API → JWT Secret. Add it to `.env` and `.env.example`.

### 2.4 Strip `os.getenv` from all modules — use `config` instead

Every module currently has its own `client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))`. Replace across all files:

Files to update: `blurting.py`, `chatbot.py`, `context.py`, `feynman_feedback.py`, `flashcard_generator.py`, `pdf_parser.py`, `quiz.py`, `review_sheet.py`, `study_session.py`, `teaching.py`, `teaching_enhanced.py`

Pattern for each:
```python
# Remove: from dotenv import load_dotenv; load_dotenv()
# Remove: client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
# Add:
from config import OPENAI_API_KEY
from openai import OpenAI
client = OpenAI(api_key=OPENAI_API_KEY)
```

For `context.py` also replace Supabase init:
```python
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE)
```

For `teaching_enhanced.py` also:
```python
from config import YOUTUBE_API_KEY
```

### 2.5 Verify

- [ ] `python -c "from config import OPENAI_API_KEY; print('ok')"` works
- [ ] No `os.getenv(` calls remain in any module except `config.py`: `grep -rn "os.getenv\|os.environ" backend/*.py | grep -v config.py`
- [ ] No `load_dotenv` in any file except `config.py`: `grep -rn "load_dotenv" backend/*.py | grep -v config.py`
- [ ] No Lovable URLs in `main.py`: `grep -n "lovable" backend/main.py`
- [ ] `/ping` still returns `{"status": "ok"}`

---

## Phase 3: Backend — Logging, Module Consolidation, Slop Removal

**Goal:** Replace 200+ emoji print statements with real logging. Resolve teaching/YouTube duplication. Fix model name. Fix async antipatterns. Eliminate obvious slop from prompts and code.

### 3.1 Set up real logging

Add to top of `main.py`:
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
```

Remove the `log_exceptions` middleware — uvicorn already logs unhandled exceptions.

### 3.2 Replace print statements in every module

Every file has `print("🚀 ...", ...)` style debug output. Replace all of it.

In each module, add at top:
```python
import logging
logger = logging.getLogger(__name__)
```

Replacement rules:
- `print(f"Starting X")` → `logger.info("Starting X")`
- `print(f"❌ X failed: {e}")` → `logger.exception("X failed")` (includes traceback automatically)
- `print(f"⚠️ Warning: X")` → `logger.warning("X")`
- Delete any print that just says what the next line of code does — if it's obvious from the code, it's noise

Files: `study_session.py`, `chatbot.py`, `context.py`, `blurting.py`, `feynman_feedback.py`, `flashcard_generator.py`, `quiz.py`, `review_sheet.py`, `teaching.py`, `teaching_enhanced.py`, `pdf_parser.py`

After: `grep -Prn '[^\x00-\x7F]' backend/*.py` must return zero results (no emojis).

### 3.3 Resolve `teaching.py` / `teaching_enhanced.py` / `video_learning.py` duplication

Current situation:
- `teaching.py` — text-only lesson generator, simple
- `teaching_enhanced.py` — combined YouTube search + lesson generator (duplicates YouTube logic from `video_learning.py`). This is the one the frontend actually uses via `/api/teaching`.
- `video_learning.py` — standalone YouTube module. Also registers `/api/youtube`, conflicting with `teaching_enhanced.py`.

Both `video_learning_router` and `teaching_enhanced_router` are mounted in `main.py`, meaning `/api/youtube` is registered twice — a route conflict.

**Resolution:**
1. Delete `video_learning.py` — its YouTube search logic is fully contained inside `teaching_enhanced.py`.
2. Rename `teaching_enhanced.py` → `teaching.py` (the old `teaching.py` is superseded).
3. Update `main.py` imports: remove `video_learning_router` and `teaching_enhanced_router`, add single `teaching_router` from the renamed file.
4. Rename the router variable inside the new `teaching.py` to just `router`.

**Before touching anything:** Confirm the frontend calls `/api/teaching` (not `/api/youtube` directly for lesson content). Check `src/services/teachingApi.ts` — it should POST to `/api/teaching`. If confirmed, `video_learning.py` is safe to delete.

### 3.4 Fix the model name in `study_session.py`

```python
model="gpt-5-nano"  # this model does not exist
```

`gpt-5-nano` is not a real OpenAI model as of 2025. The correct nano-tier model is `gpt-4.1-nano`. Update to:
```python
model="gpt-4.1-nano"
```

Verify it works by running the study session endpoint with a test payload.

### 3.5 Trim the over-engineered prompt in `study_session.py`

`build_enhanced_prompt()` is ~80 lines of emoji-decorated instructions with redundant repetition. The GPT system prompt + assistant examples cover the same ground three times. Recruiters reading this file will see AI slop immediately.

Clean it up:
- Remove the ✅/❌ emoji formatting from the prompt string
- Remove duplicate instructions (the "TOPIC SCOPE GUIDELINES" and "REQUIREMENTS" sections say the same thing)
- The three `ASSISTANT_EXAMPLE_JSON_*` strings are fine to keep (few-shot examples are valuable) but move them to module-level constants, not buried inside the function
- Target: `build_enhanced_prompt()` should be ~30 lines, the system prompt ~15 lines

### 3.6 Fix `context.py` — ThreadPoolExecutor antipattern

`context.py` uses a module-level `ThreadPoolExecutor` to wrap sync Supabase calls in async endpoints. Replace with Python 3.9+ `asyncio.to_thread()`:

```python
# Remove: executor = ThreadPoolExecutor(max_workers=10)

# Replace:
future = executor.submit(operation_func)
return future.result(timeout=timeout_seconds)

# With:
return await asyncio.wait_for(asyncio.to_thread(operation_func), timeout=timeout_seconds)
```

Also remove `from concurrent.futures import ThreadPoolExecutor, TimeoutError` import.

### 3.7 Fix self-referencing HTTP calls

`blurting.py` and `chatbot.py` make HTTP calls to `CONTEXT_API_BASE/api/context/cache` — the backend calling itself. This adds 100-300ms latency per request for no reason.

Fix: Extract the context-fetching logic in `context.py` into a directly-callable async function, then import it:

In `context.py`, add:
```python
async def get_user_context(user_id: str) -> dict | None:
    """Directly callable version of the /api/context/cache endpoint logic."""
    # move the core cache-lookup + Supabase query logic here
    ...
```

In `blurting.py` and `chatbot.py`, replace:
```python
# DELETE: the aiohttp/httpx call to context endpoint
# ADD:
from context import get_user_context
context = await get_user_context(user_id)
```

### 3.8 Verify

- [ ] `grep -Prn '[^\x00-\x7F]' backend/*.py` → zero results (no emojis)
- [ ] `grep -rn "^print(" backend/*.py` → zero results
- [ ] `video_learning.py` is deleted
- [ ] `teaching_enhanced.py` is renamed to `teaching.py`
- [ ] No duplicate `/api/youtube` route: `grep -n "youtube" backend/main.py` shows one registration only
- [ ] `uvicorn main:app --port 10000 --reload` starts without warnings
- [ ] POST `/api/study-session` with `{"objective": "photosynthesis", "duration": 30}` and a valid `x-user-id` header returns a plan with blocks

---

## Phase 4: Frontend — Centralize Types & Shared Utilities

**Goal:** Eliminate the most glaring AI slop: the same `StudyBlock` interface is defined in 4 separate files, and `getTechniqueIcon` is defined in 4 separate places. Make the codebase look like a human wrote it.

### 4.1 Create `src/types/index.ts` — single source of truth for shared types

Currently `StudyBlock` is independently defined (with slight variations) in:
- `src/services/api.ts`
- `src/components/StudyPlanEditor.tsx`
- `src/components/session/StudyBlockDisplay.tsx`
- `src/utils/studyPlanValidation.ts`

Pick the most complete definition (likely the one in `studyPlanValidation.ts` which has the most fields) and put it in `src/types/index.ts`:

```typescript
// src/types/index.ts

export interface StudyBlock {
  id: string;
  unit: string;
  technique: string;
  techniques: string[];
  phase: string;
  tool: string;
  duration: number;
  description: string;
  position: number;
  custom: boolean;
  user_notes: string | null;
}

export interface StudyPlan {
  session_id: string;
  topic: string;
  total_duration: number;
  pomodoro: string;
  units_to_cover: string[];
  techniques: string[];
  blocks: StudyBlock[];
}

export type StudyTechnique = 'flashcards' | 'feynman' | 'blurting' | 'quiz' | 'teaching';

export type AppState = 'landing' | 'editing' | 'studying' | 'complete' | 'history';
```

Then remove the local definitions in each file and import from `@/types`.

### 4.2 Create `src/lib/techniques.ts` — single source of truth for technique metadata

Currently `getTechniqueIcon` / `getTechniqueLabel` / technique color mappings are duplicated in:
- `src/components/StudyTechniques.tsx`
- `src/components/StudyWorkspaceWithSequence.tsx`
- `src/components/common/loading/TechniqueIcon.tsx`
- `src/components/session/StudyBlockDisplay.tsx`

Consolidate into one file:

```typescript
// src/lib/techniques.ts
import { BookOpen, Target, Brain, MessageCircle, PenTool, GraduationCap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const TECHNIQUES = {
  flashcards: { label: 'Flashcards', icon: BookOpen, color: 'blue' },
  feynman:    { label: 'Feynman',    icon: Brain,     color: 'purple' },
  blurting:   { label: 'Blurting',   icon: PenTool,   color: 'green' },
  quiz:       { label: 'Quiz',       icon: Target,    color: 'orange' },
  teaching:   { label: 'Teaching',   icon: GraduationCap, color: 'indigo' },
} as const satisfies Record<string, { label: string; icon: LucideIcon; color: string }>;

export type TechniqueKey = keyof typeof TECHNIQUES;

export const getTechniqueIcon = (technique: string): LucideIcon =>
  TECHNIQUES[technique as TechniqueKey]?.icon ?? Brain;

export const getTechniqueLabel = (technique: string): string =>
  TECHNIQUES[technique as TechniqueKey]?.label ?? technique;
```

Then delete the local versions in each file and import from `@/lib/techniques`.

### 4.3 Verify

- [ ] `grep -rn "interface StudyBlock" frontend/src/` → exactly 1 result (in `src/types/index.ts`)
- [ ] `grep -rn "getTechniqueIcon\|getTechniqueLabel" frontend/src/` → all lines are imports from `@/lib/techniques`, no local definitions
- [ ] `npm run build` passes with no TypeScript errors

---

## Phase 5: Frontend — Environment & Debug Cleanup

**Goal:** No hardcoded URLs or keys, no debug components, no console.log spam, no dead files.

### 5.1 Move API base URL to env var

Hardcoded `'https://arlo-mvp-2.onrender.com'` appears in:
- `src/services/api.ts`
- `src/services/studyModeApi.ts`
- `src/services/studyModulesApi.ts`
- `src/services/studyModulesApiFixed.ts`
- `src/services/teachingApi.ts`
- `src/services/sessionApi.ts`

In each file, replace:
```typescript
const API_BASE_URL = 'https://arlo-mvp-2.onrender.com/api';
// or
const API_BASE_URL = 'https://arlo-mvp-2.onrender.com';
```
with:
```typescript
const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:10000'}/api`;
```
(adjust `/api` suffix per file based on whether it was included before)

### 5.2 Move Supabase config to env vars

`src/integrations/supabase/client.ts` has the URL and anon key hardcoded. Replace:
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing Supabase environment variables. Check .env.local');
}
```

### 5.3 Delete debug-only files and components

**Delete these files entirely:**
- `src/components/DebugPanel.tsx` — developer testing tool (CORS, plan tests, network tests). Delete it.
- `src/services/networkDebug.ts` — debug utility. Delete it.

**Find and remove all references:**
```bash
grep -rn "DebugPanel\|networkDebug" frontend/src/
```
Remove every import and usage found.

### 5.4 Consolidate `studyModulesApi.ts` + `studyModulesApiFixed.ts`

`studyModulesApiFixed.ts` is AI slop — Lovable generated a "fixed" version instead of updating the original. One of them is unused.

```bash
grep -rln "studyModulesApiFixed\|from.*studyModulesApi" frontend/src/
```

Keep whichever one components actually import. Delete the other. If the "fixed" version is the live one, rename it to `studyModulesApi.ts` and update imports.

### 5.5 Remove all `console.log` / `console.warn` spam

~540 console statements exist. They read as "I didn't clean this up."

```bash
# See which files have the most:
grep -rln "console\." frontend/src/ | xargs wc -l | sort -rn
```

Go file by file. Delete every `console.log`. Delete `console.warn` unless it's a genuinely meaningful warning. Keep `console.error` only at true catch blocks where no toast/UI feedback exists (and even then, prefer throwing to let an error boundary handle it).

Files with the most hits:
- `src/services/api.ts` — ~25 debug logs
- `src/pages/Index.tsx` — scattered throughout
- `src/hooks/useStudySessionWithSequence.ts`
- `src/services/studyModeApi.ts`
- `src/services/teachingApi.ts`

### 5.6 Remove `lovable_component` field

`StudyBlock` has a `lovable_component: string` field that the backend always sets to `"text-block"` and the frontend ignores. It's dead weight from Lovable's architecture.

- Remove from `src/types/index.ts` (after Phase 4)
- Remove from `src/services/api.ts` interface (already consolidated after Phase 4)
- Remove from backend `study_session.py`: delete `lovable_component="text-block"` from the `StudyBlock` constructor, and remove the field from the Pydantic `StudyBlock` model

### 5.7 Verify

- [ ] `grep -rn "onrender.com\|lovable" frontend/src/` → zero results
- [ ] `grep -rn "DebugPanel\|networkDebug\|studyModulesApiFixed" frontend/src/` → zero results
- [ ] `grep -rn "console\.log" frontend/src/` → zero results
- [ ] `grep -rn "lovable_component" frontend/src/ backend/` → zero results
- [ ] `npm run build` passes

---

## Phase 6: Frontend — Component Architecture & Style Standardization

**Goal:** Decompose the God component `Index.tsx`. Merge near-identical Setup components. Create shared `apiClient.ts` that every service uses. Standardize repeated Tailwind patterns using `cn()` helpers or Tailwind config.

### 6.1 Create `src/lib/apiClient.ts` — shared fetch wrapper

Every service file currently reimplements `getAuthenticatedHeaders`. Extract once:

```typescript
// src/lib/apiClient.ts
import { supabase } from '@/integrations/supabase/client';

const BASE = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:10000'}/api`;

const getHeaders = async (): Promise<HeadersInit> => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user?.id) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'x-user-id': session.user.id,
  };
};

export const apiPost = async <T>(path: string, body: unknown): Promise<T> => {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
};

export const apiGet = async <T>(path: string): Promise<T> => {
  const headers = await getHeaders();
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
};
```

Then slim down each service file. Example after refactor:
```typescript
// src/services/studyModeApi.ts
import { apiPost } from '@/lib/apiClient';
import type { FeynmanExerciseRequest, FeynmanExerciseResponse } from '@/types';

export const generateFeynmanExercises = (req: FeynmanExerciseRequest) =>
  apiPost<FeynmanExerciseResponse>('/feynman/exercises', req);

export const assessFeynmanExplanation = (req: FeynmanAssessRequest) =>
  apiPost<FeynmanAssessResponse>('/feynman/assess', req);
```

### 6.2 Merge `FeynmanSetup.tsx` and `BlurtingSetup.tsx` into one `ModeSetup.tsx`

These two components are nearly identical — same imports, same "use custom topic" toggle, same "Back" button, same loading state. The only differences are the title text and icon.

Create `src/components/modes/ModeSetup.tsx`:

```tsx
interface ModeSetupProps {
  technique: TechniqueKey;
  currentBlock?: { unit: string };
  onExit: () => void;
  onStart: (topic: string) => void;
  isLoading: boolean;
}

const ModeSetup = ({ technique, currentBlock, onExit, onStart, isLoading }: ModeSetupProps) => {
  const [customTopic, setCustomTopic] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const { label, icon: Icon } = TECHNIQUES[technique];

  if (isLoading) return <UniversalLoadingScreen technique={technique} />;

  return (
    <Card>
      <CardContent>
        <Icon size={24} />
        <h2>{label}</h2>
        {/* topic toggle + input */}
        <Button onClick={() => onStart(useCustom ? customTopic : currentBlock?.unit ?? '')}>
          Start
        </Button>
      </CardContent>
    </Card>
  );
};
```

Delete `FeynmanSetup.tsx` and `BlurtingSetup.tsx`. Update `FeynmanMode.tsx` and `BlurtingMode.tsx` to use `<ModeSetup technique="feynman" .../>` and `<ModeSetup technique="blurting" .../>`.

### 6.3 Fix TypeScript `any` types

`any` is the tell that code was AI-generated and not reviewed. Run:
```bash
grep -rn ": any\b\|as any\b\|<any>" frontend/src/ | grep -v "node_modules\|\.d\.ts"
```

Every hit needs a proper type. Common cases:
- `const payload: any = {}` → define a typed interface for the payload
- `lessons?: any[]` in service types → define `TeachingLesson` interface
- `feedback: any` in mode components → use the actual API response type
- Component props typed as `any` → proper interface

### 6.4 Decompose `Index.tsx`

`src/pages/Index.tsx` is 700+ lines and manages 15+ state variables. This reads as generated code. Break it up.

The hook `useStudySessionWithSequence` already pulls out most state. `Index.tsx` just needs to be a router between views:

Create these view components (each gets only the props it needs):
- `src/components/views/LandingView.tsx` — renders `FastSessionPlanner`
- `src/components/views/EditingView.tsx` — renders `StudyPlanEditor`
- `src/components/views/StudyingView.tsx` — renders `StudyWorkspaceWithSequence` + chatbot
- `src/components/views/CompleteView.tsx` — renders `SessionComplete`
- `src/components/views/HistoryView.tsx` — renders `SessionHistory`

Result: `Index.tsx` becomes:
```tsx
const Index = () => {
  const session = useStudySessionWithSequence();
  
  return (
    <ProtectedRoute>
      <AppHeader />
      {session.appState === 'landing' && <LandingView onGenerate={session.handleGeneratePlan} />}
      {session.appState === 'editing' && <EditingView plan={session.currentPlan} ... />}
      {session.appState === 'studying' && <StudyingView ... />}
      {session.appState === 'complete' && <CompleteView ... />}
      {session.appState === 'history' && <HistoryView />}
    </ProtectedRoute>
  );
};
```

Target: `Index.tsx` under 60 lines.

### 6.5 Standardize repeated Tailwind patterns

The codebase has inline class strings like:
```
bg-gradient-to-br from-green-50/50 to-emerald-50/50 backdrop-blur-sm border-2 border-green-100 rounded-xl shadow-md hover:shadow-lg transition-all duration-300
```
repeated across 10+ components with slight variations. This makes the UI inconsistent and the code noisy.

Approach: Add semantic class groups to `src/lib/styles.ts`:
```typescript
// src/lib/styles.ts
export const card = {
  base: 'rounded-xl border bg-white shadow-sm',
  interactive: 'rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow duration-200',
  highlight: 'rounded-xl border-2 border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30 shadow-sm',
} as const;

export const btn = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  ghost: 'text-gray-600 hover:bg-gray-100',
} as const;
```

Then use with `cn()`:
```tsx
<Card className={card.interactive}>
```

Don't try to eliminate all Tailwind inline classes — just the repeated 8+ class strings that appear in 3+ places. Identify and consolidate the top 5 most-repeated patterns.

### 6.6 Add `ErrorBoundary`

Create `src/components/ErrorBoundary.tsx`:
```tsx
import { Component, ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center text-center">
          <div>
            <p className="text-lg font-medium">Something went wrong</p>
            <p className="text-sm text-gray-500 mt-1">Please refresh the page</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Wrap `<App />` in `src/main.tsx`.

### 6.7 Verify

- [ ] `grep -rn ": any\b\|as any\b" frontend/src/` → zero or justified exceptions with `// intentional` comment
- [ ] `grep -rn "getAuthenticatedHeaders\|getAuthenticatedUserId" frontend/src/` → zero (all replaced by `apiClient.ts`)
- [ ] `FeynmanSetup.tsx` and `BlurtingSetup.tsx` are deleted
- [ ] `Index.tsx` is under 80 lines
- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm run dev` — full flow: login → generate plan → complete a study block

---

## Phase 7: API Contract, Integration Testing & Final Slop Pass

**Goal:** Ensure everything actually works end-to-end. Documented endpoints. Types in sync. Smoke tests.

### 7.1 Full endpoint inventory (confirm all work)

| Method | Path | Module | Frontend caller |
|--------|------|--------|-----------------|
| POST | /api/study-session | study_session.py | `api.ts: generateStudyPlan` |
| POST | /api/flashcards | flashcard_generator.py | `studyModulesApi.ts` |
| POST | /api/quiz/generate | quiz.py | `studyModulesApi.ts` |
| POST | /api/chat | chatbot.py | `ArloChatbot.tsx` |
| POST | /api/review | review_sheet.py | check |
| POST | /api/feynman/exercises | feynman_feedback.py | `studyModeApi.ts` |
| POST | /api/feynman/assess | feynman_feedback.py | `studyModeApi.ts` |
| POST | /api/blurting/exercises | blurting.py | `studyModeApi.ts` |
| POST | /api/blurting/assess | blurting.py | `studyModeApi.ts` |
| GET/POST | /api/context/* | context.py | internal only |
| POST | /api/parse-pdf | pdf_parser.py | `FastSessionPlanner.tsx` |
| POST | /api/teaching | teaching.py | `teachingApi.ts` |
| POST | /api/youtube | teaching.py | `TeachingMode.tsx` |

For each row: confirm the TypeScript request type exactly matches the Pydantic request model. Fix any gaps.

### 7.2 Create `backend/smoke_test.sh`

```bash
#!/bin/bash
# Run against local server: bash smoke_test.sh
# Requires a valid user ID in USER_ID env var

BASE="http://localhost:10000"
USER="${USER_ID:-test-user-123}"
PASS=0; FAIL=0

check() {
  local name=$1; local result=$2
  if [ "$result" = "ok" ]; then
    echo "✓ $name"; ((PASS++))
  else
    echo "✗ $name: $result"; ((FAIL++))
  fi
}

check "ping" "$(curl -sf $BASE/ping | python3 -c 'import sys,json; d=json.load(sys.stdin); print("ok" if d.get("status")=="ok" else "bad")')"

check "study-session" "$(curl -sf -X POST $BASE/api/study-session \
  -H 'Content-Type: application/json' -H "x-user-id: $USER" \
  -d '{"objective":"photosynthesis","duration":30}' \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("ok" if "blocks" in d and len(d["blocks"])>0 else "bad")')"

echo ""; echo "$PASS passed, $FAIL failed"
[ $FAIL -eq 0 ] || exit 1
```

Run `bash smoke_test.sh` and fix any failures before moving on.

### 7.3 Final slop audit — backend

Run these checks and fix every result:
```bash
# No emojis
grep -Prn '[^\x00-\x7F]' backend/*.py

# No bare prints
grep -rn "^print\b\|^    print\b" backend/*.py

# No hardcoded URLs in code
grep -rn "onrender.com\|lovable\|arlo-mvp-2" backend/*.py

# No leftover os.getenv outside config.py
grep -rn "os\.getenv\|os\.environ" backend/*.py | grep -v "config.py"
```

### 7.4 Final slop audit — frontend

```bash
# No hardcoded backend URLs
grep -rn "onrender.com\|arlo-mvp-2" frontend/src/

# No console.log
grep -rn "console\.log" frontend/src/

# No debug components
grep -rn "DebugPanel\|networkDebug" frontend/src/

# No lovable references
grep -rn "lovable\|lovable_component" frontend/src/

# No duplicate type definitions
grep -rn "interface StudyBlock" frontend/src/

# TypeScript build clean
cd frontend && npm run build 2>&1 | grep -E "error|warning" | head -20
```

All must return zero results.

### 7.5 Verify

- [ ] All smoke tests pass
- [ ] Full user flow tested manually: login → paste a topic → generate plan → run flashcard block → run feynman block → end session → see session complete screen
- [ ] No browser console errors during normal use
- [ ] All final audit grep commands return zero results

---

## Phase 8: Production Readiness

**Goal:** Backend startup validation, rate limiting, clean `requirements.txt`, root README.

### 8.1 Backend startup check

Add to `main.py`:
```python
@app.on_event("startup")
async def on_startup():
    logger = logging.getLogger("arlo.startup")
    from config import OPENAI_API_KEY, SUPABASE_URL
    logger.info(f"Starting Arlo backend | env={ENV} | supabase={SUPABASE_URL}")
    logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")
```

### 8.2 Rate limiting on expensive endpoints

```bash
pip install slowapi
```

```python
# main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

In `study_session.py` and `chatbot.py`:
```python
@router.post("/study-session")
@limiter.limit("10/minute")
async def generate_plan(data: StudyPlanRequest, request: Request):
    ...
```

### 8.3 Clean `requirements.txt`

After all backend changes:
```bash
cd backend
pip freeze > requirements.txt
```

Review the output — remove anything not actually imported in the codebase. Common bloat to check: `aiohttp` (replaced by `httpx`?), any Lovable-era packages.

### 8.4 Frontend production build config

In `frontend/vite.config.ts` verify/add:
```typescript
build: {
  sourcemap: false,
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        supabase: ['@supabase/supabase-js'],
      }
    }
  }
}
```

### 8.5 Root README

`/Users/jakestephen/Documents/GitHub/Arlo/README.md` — clean, concise, recruiter-facing:

```
# Arlo — AI Study Tutor

An AI-powered study session generator. Enter a topic or upload notes, get a
personalized study plan with flashcards, Feynman technique, quiz, and blurting exercises.

## Architecture
Browser → React/Vite (Supabase auth) → FastAPI backend → OpenAI API + Supabase DB

## Local Setup
# Backend
cd backend && pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn main:app --port 10000 --reload

# Frontend
cd frontend && npm install
cp .env.example .env.local   # fill in keys
npm run dev

## Tech
- Backend: Python, FastAPI, OpenAI API (Responses API + structured outputs)
- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Auth & DB: Supabase (Postgres + Row Level Security)
```

### 8.6 Final verification

- [ ] `cd backend && uvicorn main:app --port 10000` — clean startup log, no warnings
- [ ] `cd frontend && npm run build` — zero errors, zero warnings
- [ ] Full user flow works end-to-end in browser
- [ ] `grep -rn "lovable\|Lovable\|arlo-mvp-2\|onrender" backend/ frontend/src/` → zero results
- [ ] `git status` — `.env` and `.env.local` are NOT staged
- [ ] README at repo root is clean and accurate

---

## Summary Table

| Phase | Key deliverable | Files most affected |
|-------|-----------------|---------------------|
| 1 | Dead files gone, .env pattern in place | Delete 3 backend files, create 2 `.env.example` |
| 2 | Config centralized, CORS/JWT secure | `config.py` (new), `main.py`, all 11 modules |
| 3 | Real logging, modules consolidated, slop prompts trimmed | All backend modules, delete `video_learning.py`, rename `teaching_enhanced.py` |
| 4 | `StudyBlock` defined once, technique helpers defined once | `src/types/index.ts` (new), `src/lib/techniques.ts` (new), 4+ components updated |
| 5 | No hardcoded URLs, no debug artifacts, no console.log | All 5 service files, `supabase/client.ts`, delete `DebugPanel` + `networkDebug` + `studyModulesApiFixed` |
| 6 | Shared `apiClient`, merged Setup components, slimmed `Index.tsx`, no `any` | `src/lib/apiClient.ts` (new), delete `FeynmanSetup`+`BlurtingSetup`, `Index.tsx` |
| 7 | All endpoints verified working, smoke tests pass | `smoke_test.sh` (new), minor type fixes |
| 8 | Rate limiting, clean deps, README | `main.py`, `requirements.txt`, `README.md` |
