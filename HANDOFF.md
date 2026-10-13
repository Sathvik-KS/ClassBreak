# HANDOFF.md — OpenCode ⇄ Antigravity

Coordination happens ONLY through this repo + its files. Agents cannot talk to
each other directly. The user must direct the other agent to resume.

## Current state

- **Last updated:** 2026-10-13, end of pre-API hardening session
- **Git:** branch `main`, working tree contains this session's changes
  (committed — see `git log`)
- **Last agent:** OpenCode — pre-API hardening (rate limiting, citation
  validation, error sanitization, config fallbacks, Gemini timeout, frontend
  error/a11y fixes)
- **Prior agents:** OpenCode — Wikipedia source fix (2026-10-11); OpenCode —
  recovery + core-loop UI + PWA scaffold (2026-10-11); "Session 2" auditor
  (read-only; AUDIT_REPORT.md)
- **Running processes:** none — the smoke-test uvicorn on port 8010 was
  stopped; no dev servers left up. (Port 8000 is occupied by an unrelated
  Django dev server belonging to the user — do not use or kill it.)

## What OpenCode did this session (2026-10-13)

1. **Rate limiting enforced** (was defined-but-inert): shared slowapi limiter
   in `app/rate_limit.py` (per-IP, per-route; documented in-memory/single-
   process limits); `@limiter.limit` on feed/generate/quiz/evaluate/tutor
   (30/min) and sources search (60/min); health deliberately exempt; custom
   429 handler returns the app's `{"detail": ...}` contract + Retry-After.
   slowapi's `headers_enabled` stays off — with FastAPI its wrapper expects a
   `response: Response` endpoint param we don't use; Retry-After is computed
   in the handler from window stats instead.
2. **Citation honesty**: `validate_references()` in lessons.py — malformed
   URLs dropped; AI refs matching actually-fetched sources → `source_type=
   "wikipedia"`; valid but unfetched → `"provided"` (honest label). Structural
   only, explicitly not semantic fact-checking.
3. **Error handling**: every router logs exceptions server-side
   (`logger.exception`) and returns generic client details (no more exception
   class names in responses). Gemini sync SDK call now runs via
   `asyncio.to_thread` + `asyncio.wait_for(settings.gemini_timeout)` (30 s).
4. **Config**: invalid `RATE_LIMIT`/`RATE_LIMIT_READ` format → clear startup
   `ValidationError` (pydantic validator); unknown `AI_PROVIDER` or
   `gemini`-without-key falls back to mock; 100 kB request-body guard (413).
5. **Frontend fixes** (no new deps): DiscoverPage `href="#/..."` links never
   navigated (BrowserRouter) → react-router `Link`; QuizPage evaluation/429
   failures were invisible mid-quiz → in-quiz error banner, cleared on retry;
   429 server messages surfaced verbatim in Discover/Quiz/Tutor; aria-labels
   on tutor input + quiz textarea.
6. **Tests**: 41 → 85 (new: rate_limit, config, validation, citations,
   errors, gemini; conftest resets limiter storage per test; `pytest.ini`
   silences the pytest-asyncio deprecation). Suite fully offline.
7. **Docs**: TASKS/PROJECT_STATUS updated; AGENTS.md corrected (Dexie booleans
   are silently unindexed — no DataError thrown).

## Commands executed and actual results

| Command | Result |
|---|---|
| `venv\Scripts\python -m pytest tests -q` | 85 passed, offline |
| `npm run lint` | clean |
| `npm run build` | green — 399.68 kB JS / 126.65 kB gzip |
| uvicorn(mock) :8010 + `GET /api/health` | 200, `ai_provider: mock` (no key) |
| 31× `POST /api/tutor/chat` (mock) | 30×200 then 429 `{"detail":"Rate limit exceeded: 30 per 1 minute"}`, `Retry-After: 56`; health still 200 |

## Defects

- **FIXED this session:** inert rate limiting; fabricated-citation channel;
  leaking error details; broken Discover hash-links; invisible mid-quiz eval
  failures; Gemini event-loop blocking + no timeout; keyless-gemini crash
  mode; invalid RATE_LIMIT crash.
- **Still open** (see TASKS.md): PWA offline runtime unverified (REVIEW —
  needs visible device); mock lesson not topic-diverse; quiz attempts store
  `answers: []`; README overstates offline; no frontend tests (needs vitest
  approval).

## Current task

None in progress. Pre-API hardening is COMPLETE and committed.

## Exact next step for whichever agent picks this up

1. Read `AGENTS.md`, `PROJECT_STATUS.md`, `TASKS.md`, this file.
2. `git status` — non-empty means another agent owns uncommitted work: stop and read the diff.
3. Remaining high-value work before real AI: none blocking — the app is safe
   to run against a real key once the user approves and sets
   `backend/.env` (`GEMINI_API_KEY`); rate limiting + timeouts + citation
   labeling are in place. Optional polish: mock diversity, README offline
   claims, PWA device test.
4. After each task: backend pytest, `npm run lint`, `npm run build`; update
   TASKS.md/HANDOFF.md/PROJECT_STATUS.md; commit; push `origin/main` (never
   force-push).

## Review requested

- Antigravity/human: PWA offline behavior still needs a **real device /
  visible-browser test** (TASKS.md "REVIEW") — SW policy was re-verified by
  static review only (no /api/ caching, no failure caching, same-origin GET).
- Any agent touching `package.json` on this machine: npm registry access here
  is slow (3.5–58 s/request); use `npm install --prefer-offline`.
- Note: port 8000 is occupied on this machine by an unrelated Django dev
  server — use another port (e.g. 8010) for uvicorn smoke tests.
