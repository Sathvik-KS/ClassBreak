# TASKS.md — ClassBreak Prioritized Work

Statuses: TODO | IN PROGRESS | BLOCKED | REVIEW | DONE
Rule: DONE requires evidence (test result, build output, or manual check recorded here).

## Current sprint: make the app runnable end-to-end (core loop)

- [x] **DONE** — Repository reconnaissance (Stage A)
  Evidence: 2026-10-11 inspection; backend pytest 27/27 pass; frontend build
  failure reproduced; findings recorded in PROJECT_STATUS.md.
- [x] **DONE** — Establish shared engineering memory (AGENTS.md, PROJECT_STATUS.md,
  HANDOFF.md, TASKS.md) + Git initialization with initial commit.
  Evidence: files created 2026-10-11; `git log` shows initial commit.
- [ ] **TODO** — Repair frontend build foundation
  - [ ] Add `dexie`, `dexie-react-hooks`, `react-router-dom` to package.json and
    reinstall so node_modules/lockfile are consistent.
  - [ ] Fix TS1294 in `src/services/api.ts` (no constructor parameter properties).
  - [ ] Fix Dexie schema: stop indexing booleans (`isDownloaded`, `synced`) —
    invalid IndexedDB keys cause runtime `DataError` on `put()`.
  - [ ] Fix lint warning in `usePreferences.ts` (impure `Date` in render).
- [ ] **TODO** — Core UI: mobile-first shell with bottom tab navigation
  (Discover / Saved / Review / Settings), routing via react-router-dom.
- [ ] **TODO** — Discover feed view: fetch + render feed items, tap → generate lesson.
- [ ] **TODO** — Lesson view: readable lesson (sections, key points, examples,
  takeaways, references), save/download for offline, links to quiz & tutor.
- [ ] **TODO** — Quiz flow: generate MC quiz, answer, evaluate, store attempt,
  update spaced-repetition schedule.
- [ ] **TODO** — Saved library + Review view (due lessons with quick self-check).
- [ ] **TODO** — Tutor chat view (context = current/saved lesson, follow-up
  suggestions). Works online only; offline shows clear message.
- [ ] **TODO** — Settings view (interests, default duration) wired to preferences.
- [ ] **TODO** — PWA basics: `manifest.webmanifest`, icons, service worker that
  caches static assets only (never API responses), registration in main.tsx.

## Backend hardening

- [ ] **TODO** — Apply slowapi rate limiting to AI endpoints
  (`@limiter.limit` on feed/generate/quiz/evaluate/tutor; limits from settings).
- [ ] **TODO** — Enforce citation honesty: filter AI-suggested lesson references
  against actually-fetched sources before returning (lessons.py "cross-check"
  comment currently describes code that doesn't exist). Add a test.
- [ ] **TODO** — Use Gemini async client (`client.aio`) in `GeminiProvider` so
  requests don't block the event loop; add explicit client timeout.
  (Needs a real key to verify; keep mock tests green.)
- [ ] **TODO** — Diversify `MockProvider.generate_lesson` beyond the single
  cocktail-party fixture (e.g. topic-templated skeleton) so offline demo of the
  reading UI isn't always the same lesson.

## Decisions / blocked on user

- [ ] **BLOCKED (needs user decision)** — PostgreSQL/auth: original stack
  expectation included PostgreSQL and authentication; the implemented + documented
  architecture is stateless/guest-first with client-only storage. Decision needed:
  keep local-first design (recommended for current priorities) or plan a
  server-side accounts phase.
- [ ] **BLOCKED (needs approval)** — Real Gemini key provisioning for live AI
  verification. Mock mode is used meanwhile; no paid calls without approval.

## Later / nice-to-have

- [ ] **TODO** — Frontend automated tests (vitest + testing-library) for quiz
  scoring and review scheduling logic.
- [ ] **TODO** — CI pipeline (lint + build + pytest) once Git hosting exists.
- [ ] **TODO** — Content-visibility/perf pass for very long lessons on low-end
  Android; lazy-load route chunks.
- [ ] **TODO** — Update README.md feature claims to match reality after each
  feature lands (README currently overstates offline/PWA support).
