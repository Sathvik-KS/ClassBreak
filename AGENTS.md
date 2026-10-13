# AGENTS.md — Shared Engineering Instructions for ClassBreak

**Every coding agent (OpenCode, Antigravity, or human) MUST read this file plus
PROJECT_STATUS.md, HANDOFF.md, and TASKS.md before touching the repository.**

## 1. Product

ClassBreak is a mobile-first personal learning app. The learning loop is:

**Discover → Understand → Explore Deeper → Remember → Connect**

Priorities: excellent Android/mobile web experience, fast startup, low memory,
readable lessons, AI-assisted explanations grounded in reliable sources, quizzes,
revision, saved lessons, offline access to saved content, guest-first onboarding,
privacy, server-side AI credentials, controlled AI cost.

Do not invent completed features. Inspect code before assuming state.

## 2. Architecture (as implemented)

- `backend/` — FastAPI (Python 3.13). Stateless AI proxy + Wikipedia source
  manager. **No server-side user database, no accounts** — this is a deliberate
  privacy-first design decision documented in README.md. Do not add PostgreSQL
  or auth without explicit user approval (see TASKS.md open decision).
- `frontend/` — React 19 + TypeScript + Vite. All user data lives client-side in
  IndexedDB (Dexie). Mobile-first responsive web app, PWA.
- AI access goes through a provider abstraction: `backend/app/services/ai_provider.py`
  (abstract interface) → `gemini.py` (hosted API) or `mock_provider.py` (offline
  fixtures). The frontend never sees AI credentials.
- Backend routes: `/api/health`, `/api/discover/feed`, `/api/lessons/generate`,
  `/api/lessons/quiz`, `/api/lessons/evaluate`, `/api/tutor/chat`,
  `/api/sources/search`.

## 3. Commands

Backend (from `backend/`):
```bash
python -m venv venv              # once; already created on this machine
venv\Scripts\activate            # Windows
venv\Scripts\pip install -r requirements.txt
venv\Scripts\uvicorn app.main:app --reload --port 8000
venv\Scripts\python -m pytest tests -q
```

Frontend (from `frontend/`):
```bash
npm install          # keeps node_modules in sync with package.json + lockfile
npm run lint         # oxlint
npm run build        # tsc -b && vite build — MUST pass before handoff
npm run dev          # dev server on :5173
```

## 4. Conventions

- TypeScript strict settings are enabled, including `erasableSyntaxOnly`:
  **no constructor parameter properties** (`constructor(public x: T)` is a build error).
- Frontend has NO Tailwind. Use plain CSS in `src/index.css` / `src/App.css`.
  `src/utils/helpers.ts` color helpers return semantic CSS class names
  (e.g. `domain-science`), not utility-class strings.
- Keep the frontend bundle light (4 GB RAM dev machine). No heavy dependencies.
  Currently allowed extra deps: `dexie`, `dexie-react-hooks`, `react-router-dom`.
- Backend: keep the provider interface stable; add new AI capabilities as new
  abstract methods + mock implementations + tests.
- Python formatting/type style: follow the existing code (4-space indent, type
  hints, Pydantic models in `app/models/`).

## 5. Security requirements

- **Never** put API keys in frontend code, commit `.env`, or log secret values.
- AI credentials stay in backend env (`GEMINI_API_KEY`). Mock provider must keep
  working with no key.
- Do not cache private/sensitive API responses in the service worker. Only
  static assets and explicitly saved learning content may be cached offline.
- Rate limiting must stay enabled on AI endpoints (cost control).

## 6. Files requiring special care

- `backend/app/services/ai_provider.py` — provider abstraction; both providers
  and all tests depend on its shape.
- `backend/app/services/prompts.py` — prompt templates; changing them changes
  AI output quality; no test covers quality, only shape.
- `frontend/src/db/database.ts` — Dexie schema. Indexed fields must be
  valid IndexedDB key types (string/number/date). **Never index booleans** —
  IndexedDB silently skips non-key-typed values (no error is thrown), so the
  index just doesn't work; query booleans with `.filter()` instead.
- `frontend/src/types/index.ts` — mirrors backend Pydantic models; update both.
- Coordination files: `PROJECT_STATUS.md`, `HANDOFF.md`, `TASKS.md`.

## 7. Agent coordination protocol

1. Before a task: read all four coordination files; check for uncommitted changes.
2. Uncommitted changes = another agent's owned work. Do not stage, commit,
   revert, or "clean up" what you do not understand.
3. One agent implements a given task at a time; the other reviews after handoff.
4. After a task: run lint/typecheck/tests/build, review your diff, update
   PROJECT_STATUS.md + TASKS.md + HANDOFF.md, and leave the tree clean
   (commit when safe). Never rewrite history or force-push.
5. Never claim DONE in TASKS.md without evidence (test result, build output,
   or reproducible manual check).
