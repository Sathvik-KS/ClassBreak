# TASKS.md — ClassBreak Prioritized Work

Statuses: TODO | IN PROGRESS | BLOCKED | REVIEW | DONE
Rule: DONE requires evidence (test result, build output, or manual check recorded here).
Last updated: 2026-10-11 (end of OpenCode recovery + core-loop implementation session)

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
- [ ] **TODO** — Replace `/page/related/` with Wikipedia opensearch + article
  extracts API (or parse summary-only grounding) to restore multi-source
  grounding. Add a recorded-fixture test so external API decay is caught.

## Backend hardening

- [ ] **TODO** — Apply slowapi rate limiting to AI endpoints
  (`@limiter.limit` on feed/generate/quiz/evaluate/tutor; limits from settings;
  remove unused Limiter in discover.py).
- [ ] **TODO** — Enforce citation honesty: filter AI-suggested lesson references
  against actually-fetched sources (lessons.py "cross-check" comment describes
  code that doesn't exist; `source_urls` at line 59 is dead). Add a test.
- [ ] **TODO** — Use Gemini async client (`client.aio`) in `GeminiProvider`;
  requests currently block the event loop; add explicit client timeout.
- [ ] **TODO** — Diversify `MockProvider.generate_lesson` beyond the single
  cocktail-party fixture (topic-templated skeleton).
- [ ] **TODO** — Sanitize exception `detail` strings (currently leak exception
  class names to clients); set `asyncio_default_fixture_loop_scope` in pytest
  config to silence deprecation.

## Decisions / blocked on user

- [ ] **BLOCKED (needs user decision)** — PostgreSQL/auth: implemented +
  documented architecture is stateless/guest-first with client-only storage;
  original spec expected PostgreSQL + auth. Keep local-first (recommended now)
  or plan a server-side accounts phase?
- [ ] **BLOCKED (needs approval)** — Real Gemini key for live AI verification.
  Mock mode used meanwhile; no paid calls without approval.

## Later / nice-to-have

- [ ] **TODO** — Frontend automated tests (vitest) for quiz scoring, SRS
  scheduling, markdown renderer (incl. XSS escaping cases).
- [ ] **TODO** — CI pipeline (lint + build + pytest) once Git hosting exists.
- [ ] **TODO** — Bundle optimization (399 kB JS / 127 kB gzip — consider lazy
  route chunks); dark-mode visual QA; accessibility pass; real-Android test.
- [ ] **TODO** — Quiz attempts currently store an empty `answers: []` array —
  persist per-question answers for richer review history.
- [ ] **TODO** — Update README.md (it still overstates offline/PWA as shipped;
  PWA now exists but offline behavior is unverified) and replace stock
  `frontend/README.md`.
