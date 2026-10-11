# HANDOFF.md — OpenCode ⇄ Antigravity

Coordination happens ONLY through this repo + its files. Agents cannot talk to
each other directly. The user must direct the other agent to resume.

## Current state

- **Last updated:** 2026-10-11, end of Wikipedia source-retrieval fix session
- **Git:** branch `main`, clean working tree at handoff (docs + fix committed)
- **Last agent:** OpenCode — Wikipedia `/page/related/` replacement (this session)
- **Prior agent:** OpenCode — recovery + build repair + full core-loop UI + PWA scaffold
- **Other agents:** "Session 2" auditor (read-only, finished; see AUDIT_REPORT.md)
- **Running processes:** none — uvicorn (port 8011) stopped after smoke test; no dev servers left up

## What OpenCode did this session (2026-10-11)

1. **Replaced the decommissioned Wikipedia REST `/page/related/` call**
   (403, T376297) in `backend/app/services/source_manager.py` with the
   supported MediaWiki Action API: `action=opensearch` for candidate titles +
   `action=query&prop=extracts` (`exintro`, `explaintext`, `exchars=1000`,
   `redirects=1`) for summaries. The REST `/page/summary/` primary path is
   kept. Added: URL-quoting of the query, redirect/normalization resolution,
   dedupe of primary vs related sources, missing/empty-extract page skipping,
   and graceful degradation for timeouts / HTTP errors / malformed JSON.
   No signature change: `search_wikipedia(query, limit=3)` and
   `format_source_context(...)` contracts preserved; no new dependencies.
2. **Made the backend suite hermetic**: recorded 3 live fixtures
   (`backend/tests/fixtures/`, captured 2026-10-11), added an autouse conftest
   fixture that routes source_manager through `httpx.MockTransport`, and added
   `tests/test_source_manager.py` (14 tests: happy path, 403-era endpoint
   never called, 404/500 fallbacks, timeouts, malformed JSON, missing pages,
   limit/empty-query, format_source_context). Suite: 27 → 41 tests, and fully
   offline (0.71s vs 3.44s).
3. **Verified**: backend pytest 41/41; live uvicorn smoke test (3 sources from
   `/api/sources/search`, 5 references in generated lesson, nonexistent
   article → `[]`, upstream log shows summary → opensearch → extracts all 200);
   frontend `npm run lint` clean, `npm run build` green.

## Commands executed and actual results

| Command | Result |
|---|---|
| `venv\Scripts\python -m pytest tests -q` | 41 passed (0.71s), offline |
| `npm run lint` | clean |
| `npm run build` | green — 399 kB JS / 10 kB CSS (127/2.9 kB gzip) |
| uvicorn + `GET /api/sources/search?q=selective attention` | 200, 3 sources (was 1) |
| uvicorn + `POST /api/lessons/generate` | 200, 5 references (2 mock + 3 Wikipedia) |
| uvicorn + nonexistent article query | 200, `{"sources":[],"extracts":[]}` |

## Defects

- **FIXED this session:** Wikipedia `/page/related/` 403 → replaced with
  opensearch + extracts (details above).
- Still open (see PROJECT_STATUS.md §2): rate limiting not applied to routes;
  citation cross-check is prompt-only; Gemini sync-in-async; mock lesson not
  topic-diverse; PWA offline runtime unverified (REVIEW task).

## Current task

None in progress. Wikipedia source fix is COMPLETE and committed.

## Exact next step for whichever agent picks this up

1. Read `AGENTS.md`, `PROJECT_STATUS.md`, `TASKS.md`, this file.
2. `git status` — non-empty means another agent owns uncommitted work: stop and read the diff.
3. Recommended next task (highest value, safe): **TASKS.md "NEXT: Apply slowapi
   rate limiting to AI endpoints"** (required before any real Gemini key is
   configured), then citation enforcement.
4. After each task: backend pytest, `npm run lint`, `npm run build`; update
   TASKS.md/HANDOFF.md/PROJECT_STATUS.md; commit; push `origin/main` (never
   force-push).

## Review requested

- Antigravity: the PWA offline behavior needs a **real device/visible-browser
  test** (task marked REVIEW in TASKS.md) — service worker registration and
  offline lesson reading are unverified at runtime.
- Any agent touching `package.json` on this machine: npm registry access here
  is slow (3.5–58 s/request); use `npm install --prefer-offline`.
