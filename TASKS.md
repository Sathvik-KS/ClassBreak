# TASKS.md — ClassBreak Prioritized Work

Statuses: TODO | IN PROGRESS | BLOCKED | REVIEW | DONE
Rule: DONE requires evidence (test result, build output, or manual check recorded here).
Last updated: 2026-10-13 (pre-API hardening session: rate limiting, citations, errors, config, frontend fixes)

## Current sprint: make the app runnable end-to-end (core loop) — COMPLETE

- [x] **DONE** — Repository reconnaissance (Stage A)
  Evidence: 2026-10-11 inspection; backend pytest 27/27 pass; frontend build
  failure reproduced; findings recorded in PROJECT_STATUS.md + AUDIT_REPORT.md.
- [x] **DONE** — Establish shared engineering memory (AGENTS.md, PROJECT_STATUS.md,
  HANDOFF.md, TASKS.md) + Git initialization with initial commit.
  Evidence: files created 2026-10-11; `git log` shows 4 commits.
- [x] **DONE** — Repair frontend build foundation
  Evidence: `npm run build` green (`tsc -b && vite build` in ~4s), `npm run lint` clean.
  - [x] `dexie`, `dexie-react-hooks`, `react-router-dom`, `lucide-react` added to
    package.json; clean `npm install --prefer-offline` fixed corrupt node_modules.
  - [x] TS1294 fixed in `src/services/api.ts` (explicit field, no param property).
  - [x] Dexie schema: booleans no longer indexed; `useLessons` uses `.filter()`.
  - [x] `usePreferences`: module-level defaults (no impure Date in render),
    `put()`-based update fixes ensureDefaults race.
- [x] **DONE** — Core UI: mobile-first shell, bottom tab nav (Discover/Saved/
  Review/Settings), react-router-dom routing, header with online/offline badge.
  Evidence: build green; live browser verification 2026-10-11.
- [x] **DONE** — Discover feed view (feed via API, domain/difficulty chips,
  Learn → generate lesson). Evidence: live check — 10 mock items rendered,
  `POST /api/discover/feed` 200 in backend log, refresh works.
- [x] **DONE** — Lesson view (sections + safe markdown renderer, key points,
  examples, takeaways, sources, related-topic chips → new lesson,
  auto-save to IndexedDB, download toggle, delete).
  Evidence: live check — full lesson rendered after `POST /api/lessons/generate` 200.
- [x] **DONE** — Quiz flow (MC + open-ended, local MC check, server evaluation
  for open-ended, results screen, attempt persisted, SRS schedule updated).
  Evidence: live check — 3-question quiz, correct-answer feedback + explanation,
  33% results screen with reschedule messaging.
- [x] **DONE** — Saved library + Review view (due list, remembered/forgot
  self-check → SM-2-lite rescheduling, empty states).
  Evidence: live check — lesson auto-saved; Review showed "All caught up —
  1 lesson scheduled for later" after quiz.
- [x] **DONE** — Tutor chat view (lesson context, markdown answers, follow-up
  suggestion chips, offline guard). Evidence: live check — question sent,
  `POST /api/tutor/chat` 200, mock markdown answer + 3 chips rendered.
- [x] **DONE** — Settings view (interest chips, default duration, live backend
  health status incl. AI provider name, privacy note).
  Evidence: live check — "Connected · version 0.1.0 · AI provider: mock".
- [x] **DONE** — PWA basics: manifest.webmanifest, icon.svg, sw.js (static-only
  caching policy, SPA navigation fallback, API never cached), registration in
  main.tsx (PROD only), index.html metadata (title/theme-color/viewport-fit).
  Evidence: build green; files emitted to dist/.
  ⚠️ Runtime SW registration/offline behavior NOT yet verified in-browser
  (headless environment) — see REVIEW task below.
- [ ] **REVIEW** — PWA runtime verification: install prompt, offline shell,
  downloaded-lesson reading with network disabled (needs a visible device /
  Android phone test).
- [x] **DONE (verified by logs, not fixed)** — NEW BUG FOUND during live test:
  Wikipedia REST `/page/related/{query}` returns 403 "being decommissioned"
  (phabricator T376297). `source_manager.py` swallows this, so lessons still
  generate but with only ONE grounded source instead of up to 3.
- [x] **DONE** — Replace `/page/related/` with Wikipedia opensearch + article
  extracts API to restore multi-source grounding.
  Evidence (2026-10-11): `backend/pytest tests -q` → **41 passed** (0.71s;
  27 existing + 14 new in `tests/test_source_manager.py`); live uvicorn check —
  `GET /api/sources/search?q=selective attention` → 3 sources, all upstream
  calls HTTP 200 (no `/page/related/`); nonexistent article → `[]` HTTP 200;
  `POST /api/lessons/generate` → 5 references (2 mock AI + 3 Wikipedia).
  Fixtures recorded 2026-10-11 in `backend/tests/fixtures/`; conftest now
  autouse-stubs source_manager via `httpx.MockTransport` — the whole suite is
  offline (0.71s vs 3.44s before). Handles timeouts, HTTP errors, malformed
  JSON, missing/empty-extract pages, redirect dedupe; no new dependencies.

## Backend hardening

- [x] **DONE** — Apply slowapi rate limiting to AI endpoints
  Evidence (2026-10-13): shared limiter in `app/rate_limit.py` (per-IP,
  per-route scope; in-memory, single-process — documented as cost control,
  not distributed protection); `@limiter.limit` on feed/generate/quiz/
  evaluate/tutor (`settings.rate_limit`, default 30/min) + sources search
  (`settings.rate_limit_read`); unused Limiter removed from discover.py;
  custom 429 handler returns `{"detail": ...}` + Retry-After. Tests:
  `tests/test_rate_limit.py` (4: 429 after budget, health exempt, reset
  recovery). Live check: uvicorn(mock) — 30×200 then 429 `{"detail":"Rate
  limit exceeded: 30 per 1 minute"}`, `Retry-After: 56`, health still 200.
- [x] **DONE** — Enforce citation honesty: `validate_references()` in
  lessons.py structurally validates AI refs (malformed URLs dropped;
  fetched-source match → `source_type="wikipedia"`; otherwise honestly
  labeled `"provided"`; `source_urls` dead code removed). Explicitly
  structural only — no semantic fact-checking claimed.
  Evidence: `tests/test_citations.py` (10 tests) + suite green.
- [x] **DONE** — Gemini async/timeout: sync SDK call now runs via
  `asyncio.to_thread` + `asyncio.wait_for(settings.gemini_timeout)` (default
  30 s) inside `GeminiProvider._generate_json` — no provider-architecture
  change, testable with a fake client (no key needed).
  Evidence: `tests/test_gemini.py` (6 tests: thread offload, timeout bound,
  invalid JSON/empty response, key required). NOTE: still unverified against
  the real API (no key, not approved) — `client.aio` native async client
  remains optional follow-up once a key exists.
- [x] **DONE** — Sanitize exception `detail` strings: all routers log the real
  exception server-side (`logger.exception`) and return generic client
  messages; `pytest.ini` added (`asyncio_default_fixture_loop_scope`).
  Evidence: `tests/test_errors.py` (7 tests incl. "no class names/messages
  in response body"); suite green without deprecation warning.
- [x] **DONE** — Config & request validation: invalid `RATE_LIMIT` format
  rejected at startup with a clear `ValidationError`; unknown `AI_PROVIDER`
  or `gemini`-without-key falls back to mock (was: broken 502s); 100 kB body
  size guard (413); sources `q` length/emptiness 422s.
  Evidence: `tests/test_config.py` (9), `tests/test_validation.py` (7),
  live boot in mock mode with no key.
- [x] **DONE** — Frontend defect fixes (no new deps): DiscoverPage broken
  hash-links (`href="#/saved"` → react-router `Link`); QuizPage mid-quiz
  error invisible (eval/429 failures now shown in an in-quiz banner, cleared
  on retry); 429 server messages surfaced verbatim in Discover/Quiz/Tutor
  instead of misleading hints; aria-labels for tutor input + quiz textarea.
  Evidence: `npm run lint` clean; `npm run build` green (399.68 kB JS /
  126.65 kB gzip). No browser re-run this session (mock UI flow unchanged).
- [ ] **TODO** — Diversify `MockProvider.generate_lesson` beyond the single
  cocktail-party fixture (topic-templated skeleton). Low priority; mock is
  for development/testing only.

## Decisions / blocked on user

- [ ] **BLOCKED (needs user decision)** — PostgreSQL/auth: implemented +
  documented architecture is stateless/guest-first with client-only storage;
  original spec expected PostgreSQL + auth. Keep local-first (recommended now)
  or plan a server-side accounts phase?
- [ ] **BLOCKED (needs approval)** — Real Gemini key for live AI verification.
  Mock mode used meanwhile; no paid calls without approval.

## Later / nice-to-have

- [ ] **TODO** — Frontend automated tests (vitest) for quiz scoring, SRS
  scheduling, markdown renderer (incl. XSS escaping cases). Blocked on the
  "no new dependencies" constraint — needs user approval to add vitest.
- [ ] **TODO** — CI pipeline (lint + build + pytest) once Git hosting exists.
- [ ] **TODO** — Bundle optimization (399 kB JS / 127 kB gzip — consider lazy
  route chunks); dark-mode visual QA; accessibility pass; real-Android test.
- [ ] **TODO** — Quiz attempts currently store an empty `answers: []` array —
  persist per-question answers for richer review history.
- [ ] **TODO** — Update README.md (it still overstates offline/PWA as shipped;
  PWA now exists but offline behavior is unverified) and replace stock
  `frontend/README.md`.
