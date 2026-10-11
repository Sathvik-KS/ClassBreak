# PROJECT_STATUS.md — ClassBreak

Last updated: 2026-10-11 12:10 (by OpenCode, during recovery/reconnaissance)

## 1. What currently works (verified)

### Backend (`backend/`) — VERIFIED WORKING
- FastAPI app boots; routes wired: `/api/health`, `/api/discover/feed`,
  `/api/lessons/generate`, `/api/lessons/quiz`, `/api/lessons/evaluate`,
  `/api/tutor/chat`, `/api/sources/search`.
- AI provider abstraction with two implementations:
  - `GeminiProvider` (hosted `gemini-2.0-flash`, key from env, never exposed).
  - `MockProvider` (deterministic fixtures, clearly labeled `[MOCK]`).
  - Selection via `AI_PROVIDER` (`auto`/`gemini`/`mock`); `auto` → mock when no key.
- Wikipedia source grounding via REST API (`source_manager.py`).
- Pydantic request/response validation on every route.
- CORS restricted to configured origins; global exception handler hides internals.
- **Test suite: 27/27 passed** (`venv\Scripts\python -m pytest tests -q`,
  run 2026-10-11, 4.26s). Tests cover mock provider + all routes via
  httpx `ASGITransport` (no network calls).

### Frontend infrastructure (`frontend/src/`) — CODE EXISTS, NOT WIRED, BUILD FAILS
- `services/api.ts` — full API client for all backend endpoints.
- `db/database.ts` — Dexie IndexedDB schema (preferences, lessons, quizAttempts,
  reviewItems, feedHistory).
- `hooks/useLessons.ts` — save/download/delete lessons, spaced-repetition
  scheduling (SM-2-lite).
- `hooks/usePreferences.ts`, `hooks/useOnlineStatus.ts`.
- `types/index.ts` — mirrors backend models.
- `utils/helpers.ts`, `utils/constants.ts` — helpers + domain constants.

## 2. What is partially implemented or broken

- **`npm run build` FAILS** (verified 2026-10-11):
  1. `node_modules` is inconsistent with `package.json`/`package-lock.json`:
     `dexie@4.4.6` present but corrupt (missing type declarations),
     `dexie-react-hooks` absent, `react-router` present but in neither manifest.
     → tsc errors: "Could not find a declaration file for module 'dexie'",
     cascading implicit-any errors in hooks.
  2. `src/services/api.ts:8` — constructor parameter property
     (`constructor(public status: number, ...)`) violates tsconfig
     `erasableSyntaxOnly` → TS1294.
- **No UI exists.** `src/App.tsx` is still the default Vite starter template.
  Nothing imports the api client, database, or hooks. No components, no views,
  no navigation, no markdown rendering.
- **Not a PWA yet.** No `manifest.webmanifest`, no service worker, no
  `registerSW`. README claims offline support — it is not implemented.
- **Dexie schema bug (found in review, not yet fixed):** `database.ts` declares
  indexes on boolean fields (`lessons.isDownloaded`, `quizAttempts.synced`).
  Booleans are invalid IndexedDB keys → `put()` throws `DataError` at runtime.
  No UI exercises this yet, so it has not crashed in practice.
- **Rate limiting is configured but never applied.** `main.py` installs a
  slowapi `Limiter` and `discover.py` even creates one, but **no route has a
  `@limiter.limit` decorator** (verified by grep). Cost control is therefore
  inactive.
- **Fabricated-citation risk in `lessons.py`:** the comment says AI-provided
  references are "cross-checked with actual sources", but they are accepted
  verbatim; only missing Wikipedia refs are appended. Prompts instruct the model
  not to invent sources, but the server does not enforce it.
- `GeminiProvider._generate_json` uses the **synchronous** client call inside
  async methods — blocks the event loop under load; no client timeout configured.
- Lint: 1 warning (`usePreferences.ts:41` — impure `Date` call during render).
- `index.html` title is still "frontend"; `frontend/README.md` is the stock
  Vite template readme.

## 3. Dependencies and setup already completed

- Backend venv: **created 2026-10-11** at `backend/venv` (Python 3.13.1) with
  all `requirements.txt` packages installed (fastapi 0.115.6 verified).
- Frontend `node_modules` installed but **out of sync** with the lockfile
  (see above); needs a proper `npm install` after manifest repair.
- No Git repository existed; initialized 2026-10-11 by OpenCode (initial commit
  after this documentation pass).

## 4. Checks run and results (2026-10-11)

| Check | Result |
|---|---|
| `backend: pytest tests -q` | ✅ 27 passed (4.26s) |
| `frontend: npm run lint` | ⚠️ 1 warning (usePreferences render purity) |
| `frontend: npm run build` | ❌ fails — TS7016/TS2339/TS7006 (dexie types) + TS1294 (api.ts) |

## 5. Missing environment variables (names only — no secrets)

- `backend/.env` does not exist (gitignored). App runs in **mock AI mode**
  without it. To enable real AI: copy `backend/.env.example` → `backend/.env`
  and set `GEMINI_API_KEY`. Not required for development or tests.
- Frontend: `VITE_API_URL` optional (defaults to `http://localhost:8000`).

## 6. Architectural decisions and technical debt

- **Decision (existing, preserved):** no PostgreSQL, no authentication, no
  server-side user data. README documents this as a deliberate privacy-first,
  guest-first design; all user state is local (IndexedDB). This deviates from
  the originally expected stack (PostgreSQL + auth). Changing it is an **open
  product decision** tracked in TASKS.md — do not implement without approval.
- **Tech debt:** rate limiting not applied to routes; citation cross-check not
  enforced; sync Gemini call in async context; mock lesson is a single fixed
  fixture regardless of topic; no CI; frontend has no tests; README overstates
  implemented features (offline/PWA) — partially corrected in this pass.
- Frontend routing: `react-router-dom` is intended (Antigravity pre-installed
  `react-router`), pending proper manifest addition.
