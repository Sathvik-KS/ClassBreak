# HANDOFF.md — OpenCode ⇄ Antigravity

Coordination happens ONLY through this repo + its files. Agents cannot talk to
each other directly. The user must direct the other agent to resume.

## Current state

- **Last updated:** 2026-10-11, end of session (core loop complete, servers stopped)
- **Git:** branch `main`, ~4 commits, clean working tree at handoff
  (this handoff + status files are committed with the final commit).
- **Last agent:** OpenCode — recovery + build repair + full core-loop UI + PWA scaffold
- **Other agents:** "Session 2" auditor (read-only, finished; see AUDIT_REPORT.md)
- **Running processes:** none — uvicorn and vite preview were stopped; no dev servers left up

## What OpenCode did this session (2026-10-11)

1. **Reconnaissance** — found: no git, no UI (App.tsx was the Vite template),
   broken frontend build, healthy backend (27/27 tests). Wrote the four
   coordination files + git init (commit `9e1ef20`).
2. **Folded in** Session 2's independent audit (AUDIT_REPORT.md) and corrected
   one of my own claims (Dexie boolean-index behavior). Commit `8458c7a`.
3. **Repaired the frontend build** (commit `2f4e7e7`): declared
   `dexie`/`dexie-react-hooks`/`react-router-dom`/`lucide-react` + clean
   `npm install --prefer-offline` (node_modules had been corrupt from an
   interrupted install); fixed TS1294 param property in `api.ts`; removed
   boolean indexes from the Dexie schema + `.filter()` query in `useLessons`;
   fixed `usePreferences` impure-render default + ensureDefaults update race.
4. **Built the entire core-loop UI** (final commit): App shell with bottom tab
   nav + online/offline badge; Discover feed; Lesson reader (XSS-safe markdown,
   sources, related-topic chips, download/delete); Quiz (MC + open-ended,
   results, SRS rescheduling); Saved library; Review (due list, remembered/
   forgot); Tutor chat (suggestion chips); Settings (interests, duration,
   backend health); mobile-first CSS with dark mode; PWA (manifest, icon,
   static-only service worker, PROD registration). New modules:
   `services/lessonStore.ts`, `services/generateLesson.ts`,
   `utils/markdown.ts`, `components/Markdown.tsx`, `pages/*` (7 pages).

## Commands executed and actual results

| Command | Result |
|---|---|
| `venv\Scripts\python -m pytest tests -q` | 27 passed (4.26s) |
| `npm run lint` | clean |
| `npm run build` | green — 399 kB JS / 10 kB CSS (127/2.9 kB gzip) |
| uvicorn (mock) + `npm run preview` + browser E2E | full loop verified, 0 console errors |
| uvicorn during E2E | all API calls 200; Wikipedia `/page/related/` → **403 decommissioned** |

## New defect found this session (not yet fixed)

- **Wikipedia `/page/related/` decommissioned (403, T376297)** → multi-source
  grounding degraded to single-source (summary endpoint still works; app
  degrades gracefully). Task + proposed fix (opensearch/extracts API) in
  TASKS.md.

## Current task

None in progress. Core-loop sprint is COMPLETE. Working tree clean.

## Exact next step for whichever agent picks this up

1. Read `AGENTS.md`, `PROJECT_STATUS.md`, `TASKS.md`, this file.
2. `git status` — non-empty means another agent owns uncommitted work: stop and read the diff.
3. Recommended next task (highest value, safe): **TASKS.md "Replace
   `/page/related/` with a supported Wikipedia search API"** (source grounding
   integrity), then the **backend hardening** block (rate limiting first —
   required before any real Gemini key is configured).
4. After each task: `npm run lint`, `npm run build`, backend pytest; update
   TASKS.md/HANDOFF.md/PROJECT_STATUS.md; commit.

## Review requested

- Antigravity: the PWA offline behavior needs a **real device/visible-browser
  test** (task marked REVIEW in TASKS.md) — service worker registration and
  offline lesson reading are unverified at runtime.
- Any agent touching `package.json` on this machine: npm registry access here
  is slow (3.5–58 s/request); use `npm install --prefer-offline`.
