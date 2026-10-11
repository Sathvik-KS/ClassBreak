# HANDOFF.md — OpenCode ⇄ Antigravity

Coordination happens ONLY through this repo + its files. Agents cannot talk to
each other directly. The user must direct the other agent to resume.

## Current state

- **Last updated:** 2026-10-11 12:15
- **Git:** repository initialized 2026-10-11 (none existed before). Initial
  commit contains the pre-existing Antigravity work + coordination docs.
  Branch: `main`.
- **Last agent:** OpenCode (recovery/reconnaissance session)

## What OpenCode did this session (2026-10-11)

1. Full repository inspection (no files deleted or overwritten).
   Findings recorded in PROJECT_STATUS.md.
2. Created `backend/venv` (Python 3.13.1) and installed `requirements.txt`.
   Verified: `pytest tests -q` → **27 passed**.
3. Reproduced the frontend build failure (`npm run build`):
   - `node_modules` inconsistent with `package.json`/`package-lock.json`
     (corrupt `dexie`, missing `dexie-react-hooks`, orphan `react-router`).
   - TS1294 in `src/services/api.ts` (constructor parameter property vs
     `erasableSyntaxOnly`).
4. Created coordination files: `AGENTS.md`, `PROJECT_STATUS.md`,
   `TASKS.md`, `HANDOFF.md`; `git init` + initial commit.

No application source files were modified in this session.

## Commands executed and actual results

| Command | Result |
|---|---|
| `git status` (before init) | fatal: not a git repository |
| `python -m venv venv` + pip install (backend) | success, fastapi 0.115.6 importable |
| `venv\Scripts\python -m pytest tests -q` | 27 passed in 4.26s (pytest-asyncio deprecation warning only) |
| `npm run lint` (frontend) | 1 warning: `src/hooks/usePreferences.ts:41` impure `Date` in render |
| `npm run build` (frontend) | FAIL: TS7016/TS2339/TS7006 (dexie types) + TS1294 (`api.ts:8`) |

## Outstanding issues

- Frontend does not build; no UI exists (`App.tsx` is the Vite starter).
- Dexie schema indexes booleans → runtime `DataError` risk on `put()`.
- Rate limiting configured but not applied to any route.
- AI lesson references not actually validated against fetched sources.
- README overstates shipped features (PWA/offline).
- Open decision: PostgreSQL/auth vs. documented local-first design (user needed).

## Current task

Reconnaissance complete; next task per TASKS.md:
**"Repair frontend build foundation"** (manifest deps + TS fixes + Dexie schema
fix), then build the core UI incrementally.

## Exact next step for whichever agent picks this up

1. Read `AGENTS.md`, `PROJECT_STATUS.md`, `TASKS.md`, this file.
2. Run `git status` — if non-empty, another agent owns uncommitted work: stop and
   read the diff before doing anything.
3. Take the first non-DONE item in TASKS.md under "Current sprint", in order.
4. After each task: `npm run lint`, `npm run build`, backend pytest; update
   TASKS.md/HANDOFF.md/PROJECT_STATUS.md; commit.

## Review requested

- Antigravity: review the Dexie boolean-index finding and the planned
  dependency additions (dexie, dexie-react-hooks, react-router-dom) before UI
  work diverges, if you disagree — raise it via TASKS.md.
