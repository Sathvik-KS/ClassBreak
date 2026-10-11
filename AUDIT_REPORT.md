# ClassBreak — Independent Audit Report (Session 2)

- **Auditor:** Session 2 (independent senior engineer / code auditor)
- **Date:** 2026-10-11 12:06 local (06:36 UTC)
- **Mode:** Read-only audit. No source files were modified.
- **Scope:** `C:\Users\kssat\Downloads\ClassBreak` (backend/ + frontend/)
- **Peers:** Session 1 (implementing), Antigravity, user

> This report is the shared engineering record requested for this audit. No
> `AGENTS.md`, `PROJECT_STATUS.md`, `HANDOFF.md`, or `TASKS.md` existed when
> this audit began. The repository is **not a git repository** — see §2.

---

## 1. Executive Summary

ClassBreak is an early-stage full-stack scaffold: a FastAPI backend (AI proxy,
Wikipedia source grounding, mock AI provider) and a React + Vite frontend that
is still the stock Vite template. The backend is in **good shape and fully
green** (27/27 tests pass in ~4s). The frontend does **not build** (TypeScript
errors, exit 2), its `App.tsx` still renders the Vite demo page, and its
declared PWA/offline/IndexedDB features are either not wired into any UI or
rely on dependencies that are not recorded in `package.json`.

Regarding Session 1: **we could not confirm a hung process.** The last commands
that actually executed on this machine (`npm run lint` ✅ and `npm run build` ❌
at 11:49–11:50, `pytest` ✅ at ~11:51) all *completed*. No `node`, `npm`,
`python`, or `uvicorn` process was running during our process scan. The
credible story is that npm operations on this box are pathologically slow
(registry fetches measured at 3.5–58s per request) and that an earlier
`npm install` of extra frontend packages was **interrupted**, leaving
`node_modules` in a partial/corrupt state. A command that *looks* hung while
npm re-validates against a very slow registry, or a build that fails, are the
likeliest explanations — but Session 1's own terminal content is not visible
to us (see §3).

### Top confirmed defects
1. **Frontend does not build** — `tsc` reports 6 errors, exit 2 (§5).
2. **`dexie`/`dexie-react-hooks` are imported by source but not declared in
   `package.json`/`package-lock.json`; `node_modules` is partial** (dexie ships
   no `.d.ts` on disk because the install was interrupted) (§8).
3. **Offline "downloaded" filter can never match** — `useLessons.ts:14` queries
   a boolean index with `equals(1)` (§5-B).
4. **Rate limiting is configured but never enforced** — no route uses
   `@limiter.limit(...)`; the README claims rate limiting (§6).
5. **README-documented PWA/offline is not implemented** — no manifest, no
   service worker (§7).

---

## 2. Current Repository State and Git Status

- **Not a git repository.** `git status` / `git log` fail with `fatal: not a git
  repository`. No `.git` directory exists at the root (nor in `backend/` or
  `frontend/`). `.gitignore` files exist but nothing has ever been committed.
  **Operational risk:** no history, no diff, no ability to review or revert
  Session 1's changes.
- **No shared coordination files exist** (`AGENTS.md`, `PROJECT_STATUS.md`,
  `HANDOFF.md`, `TASKS.md` were not found).
- Tree (top level): `backend/`, `frontend/`, `README.md`, `.gitignore`.
- `backend/.env` does **not** exist (only `.env.example`). No API keys present
  in the workspace. `frontend/.env*` does not exist.
- `backend/venv/` exists with all pinned packages installed (Python 3.13.1).
- `frontend/node_modules/` exists but is inconsistent with the manifest (§8).

---

## 3. Session 1 Investigation and Evidence

### 3.1 What we can observe (evidence)

| Item | Evidence |
|---|---|
| Last interactive command in PowerShell history | `npm install` in `frontend/` — `ConsoleHost_history.txt` last modified **11:49:13** local. Earlier entries show `cd backend; uvicorn app.main:app; .\.venv\Scripts\activate; uvicorn app.main:app; cd frontend` |
| npm `run lint` | Executed **11:49:56 local (06:19:56Z)**, `exit 0` (npm debug log `2026-10-11T06_19_56_365Z-debug-0.log`) |
| npm `run build` | Executed **11:50:00 local (06:20:00Z)**, **`exit 2`** (npm debug log `2026-10-11T06_20_00_259Z-debug-0.log`); no `frontend/dist/` produced |
| `tsc` build info | `frontend/node_modules/.tmp/tsconfig.{app,node}.tsbuildinfo` written **11:50:05–07 local** (consistent with the failed `tsc -b`) |
| pytest | `.pytest_cache` written **11:51:07 local**; `lastfailed` empty, `nodeids` lists the full suite. Our own run confirms **27 passed in 3.94s** |
| Active processes | `Get-Process` + `Get-CimInstance` at ~12:02 local: **no `node`, `npm`, `python`, `uvicorn`, or `vite` processes**. One idle `powershell.exe` (PID 6416, started 11:48:51, ~2.8s CPU over 13 min); a `conhost` (PID 15036) attached to it |
| npm registry latency (measured) | `registry.npmjs.org/dexie` → HTTP 200 in **3514 ms**; `en.wikipedia.org` REST → HTTP 200 in **447 ms**. Yesterday's install log shows 5,458–58,523 ms per manifest fetch |
| Prior `npm install react-router-dom dexie dexie-react-hooks lucide-react` (10 Oct 23:16:54) | Debug log `2026-10-10T17_44_13_693Z-debug-0.log` **ends abruptly mid-download** (line 338, no exit status). Packages were extracted into `node_modules` (mtimes 23:17–23:18) but **`package.json`/`package-lock.json` were never updated** (mtimes 23:06:36 / 23:13:04) |

### 3.2 Answers to the Phase-1 questions

1. **Exact command, if known.** Not definitively known. Candidates, in order of
   likelihood: `npm install` (last entry in interactive history, 11:49); `npm
   run build` (last recorded npm command; **failed with exit 2**, did not
   hang). We cannot see Session 1's terminal contents.
2. **Last visible output.** Not accessible to an independent reviewer. The npm
   debug logs only record exit codes (`run lint` = 0, `run build` = 2).
3. **Approximate duration.** Latest completed commands ran 11:49–11:51 local,
   i.e., ~15 minutes before this audit's process scan.
4. **Relevant process observations.** No AI/build/dev process running at scan
   time. One idle PowerShell (PID 6416) from 11:48:51 is unaccounted for; it
   may be Session 1's shell, an idle terminal, or unrelated.
5. **Likely explanations.**
   - **(A) Commands already completed** — the build *failed* (exit 2) rather
     than hanging; pytest *passed*. Session 1 may be waiting, retrying, or
     working between commands.
   - **(B) Slow npm registry makes npm commands look hung** — registry requests
     took 5–58s yesterday and 3.5s today. A bare `npm install` here can spend
     minutes with no visible progress.
   - **(C) A command is blocked/prompting in Session 1's own terminal** — the
     only plausible hang vector we found is an interactive prompt that we
     cannot see (npm has no prompts here by default; a git-less environment
     rules out commit hooks).
   - **(D) Session 1 executes in an environment we cannot inspect.**
6. **Evidence per explanation.** A: npm debug logs show clean exits (code 0 / 2)
   and cache timestamps 11:50–11:51. B: measured registry latency + yesterday's
   log timings + interrupted install log. C/D: absence of any active build
   process on this machine at scan time.
7. **Recommended next diagnostic step.** Request the tail of Session 1's current
   terminal output (or a screenshot) from the user — the single action that
   resolves the ambiguity. Check whether Session 1 is editing `package.json`
   (its mtime is currently unchanged). **Do not terminate anything.**

> **Conclusion:** Session 1 is **not demonstrably stuck** based on machine
> evidence; its last recorded command (`npm run build`) *terminated* with
> exit 2. The "stuck" appearance is most plausibly explained by slow npm I/O
> and/or the failed build, but this is a **likely explanation**, not a verified
> fact.

---

## 4. Confirmed Bugs

### Frontend (all break or corrupt the build)

| # | Severity | Where | Description |
|---|---|---|---|
| F-1 | **P1** | `frontend/src/services/api.ts:8` | `constructor(public status: number, ...)` — parameter properties are forbidden by `erasableSyntaxOnly: true` in `tsconfig.app.json:22`. Error `TS1294`. Fix: drop the `public` modifier and assign the field explicitly. |
| F-2 | **P1** | `frontend/src/db/database.ts:3` (+ cascades) | `Could not find a declaration file for module 'dexie'` (`TS7016`). `dexie@4.4.6` declares `typings: dist/dexie.d.ts` in its manifest, but **no `.d.ts` files exist on disk** — the interrupted install (log ends at line 338) never extracted them. Cascades into `TS2339 Property 'version' does not exist` (`database.ts:15`) and `TS7006 implicit any` (`useLessons.ts:58,95`, `usePreferences.ts:25`). |
| F-3 | **P1** | `frontend/src/hooks/useLessons.ts:14` | `db.lessons.where('isDownloaded').equals(1)` — rows store booleans (`false`/`true`); Dexie key lookup of `1` never matches a boolean. `downloadedLessons` is always `[]`, so the Offline/download section of the UI would never show downloaded lessons. Use `.equals(true)` or a filter. |
| F-4 | **P2** | `frontend/package.json` | Missing dependencies. Source imports `dexie`, `dexie-react-hooks` (`database.ts`, `useLessons.ts`, `usePreferences.ts`) and future UI will need `react-router-dom`, `lucide-react` (present in `node_modules`, unused). `npm ci` or a fresh `npm install` **prunes all of them** and the build then fails with `Cannot find module`. Only `react`/`react-dom` are declared. |

### Backend

| # | Severity | Where | Description |
|---|---|---|---|
| B-1 | **P2** | `backend/app/main.py:35-48`, `routers/*.py` | Rate limiting is **not enforced**. `Limiter` instances are created and `app.state.limiter` + the exception handler are wired, but **no route carries `@limiter.limit(...)`**. The README and `.env.example` advertise "rate limiting"; requests are currently unlimited. Both `rate_limit` and `rate_limit_read` config are dead. `discover.py:12` creates a second, unused `Limiter`. |
| B-2 | **P2** | `backend/app/services/gemini.py:27-36` | `_generate_json` is `async` but calls the **synchronous** `client.models.generate_content(...)` with **no timeout**. This blocks the event loop and can hang a request for the SDK's default connect timeout (up to ~120s) when Gemini is unreachable. Wrap in `asyncio.to_thread` / use the async SDK API and set a timeout. |
| B-3 | **P3** | `backend/app/routers/lessons.py:59` | Dead code: `source_urls = {r.url for r in references}` is computed and never used. |
| B-4 | **P3** | `backend/app/routers/sources.py:11-13` | Placeholder `class SourceSearchResponse: pass`; endpoint returns an untyped dict. Harmless but misleading. |
| B-5 | **P3** | `backend/app/routers/*.py` | Error `detail` strings leak Python exception class names to clients (e.g. `Failed to generate feed: TimeoutError`). Minor information disclosure; harmless for an unauthenticated toy service, but inconsistent with the generic handler's "don't leak internals" intent (`main.py:76-83`). |

---

## 5. Potential Bugs and Unverified Concerns

- **`usePreferences.ts:41` impure render** — the fallback object calls
  `new Date().toISOString()` during render (oxlint `react/purity` warning).
  Re-renders produce a new `updatedAt`; trivial here but a footgun.
- **`usePreferences.updatePreferences`** — if the `default` row does not exist
  when `updatePreferences` is called (race with async `ensureDefaults`),
  `db.preferences.update('default', ...)` resolves without creating the row.
- **Dexie boolean index** — even after fixing `equals(1)`, IndexedDB requires
  *boolean* index queries to use booleans; the schema indexes
  `isDownloaded`, which is fine once the query is fixed.
- **Duplicate domain-color tables** — `src/utils/helpers.ts:getDomainColor` and
  `src/utils/constants.ts:DOMAIN_COLORS` duplicate the same mapping and can
  drift. `helpers` uses key `'computer science'`, constants use `'programming'`.
- **No AI output length cap for lessons** — Gemini `generate_lesson` receives
  full Wikipedia extracts (`source_manager.format_source_context` concatenates
  all extracts; no truncation) while `generate_quiz` truncates to 3000 chars.
  Long extracts could push prompt size limits — unverified, untested.
- **Prompt injection surface** — user topic/interests are interpolated into
  prompts; the system prompts instruct "only cite provided sources." Acceptable
  risk for an education app, but Gemini-provider deployments should review.
- **Per-request provider construction** — `get_ai_provider()` builds a
  `genai.Client` on every request (`ai_provider.py:73-88`).
- **Mock lesson is fully static** — `MockProvider.generate_lesson` returns the
  same "Cocktail Party" lesson for every topic (retitled), and
  `generate_quiz` returns the same 3 questions. Fine for smoke-testing, not for
  feature demos; the frontend has no UI to exercise it yet.
- **`search_wikipedia`** — direct summary followed by `/page/related/{query}`;
  a 404/redirect on the summary raises HTTPError → silently falls back. URL is
  built via f-string; httpx encodes spaces. OK, but untested for edge inputs.

---

## 6. Security Findings

| Severity | Finding | Status |
|---|---|---|
| P2 (posture) | API is **completely unauthenticated and unlimited** — AI-proxy endpoints (`/api/lessons/*`, `/api/tutor/chat`, `/api/discover/feed`) cost money with a real key and have **no effective rate limit** (see B-1). DoS/cost-abuse risk once Gemini is configured. | Confirmed (config dead code, no decorators anywhere) |
| P3 | Exceptions leak exception type names in `detail` (B-5). | Confirmed |
| P3 | `CORS_ORIGINS` defaults are sensible (`localhost:5173,4173`), `allow_credentials=False`, methods limited to GET/POST. No `*` wildcard. | Verified safe |
| OK | No hardcoded secrets; no `.env` committed; `.env.example` is empty; API key never logged (only provider name in `main.py:28`). | Verified |
| OK | No DB, no SQL, no file uploads, no SSRF beyond Wikipedia GETs (fixed host). | Verified |
| NOTE | No auth is a deliberate design choice ("guest-first, all local"); the risk is abuse of the AI proxy, mitigated by the *intended* but missing rate limiter. | Design note |

---

## 7. Missing or Incomplete Features (docs vs. reality)

| Feature (README §Features) | Status |
|---|---|
| Discovery Feed UI | ❌ No UI. Only `POST /api/discover/feed` + mock items. |
| Topic Exploration UI | ❌ None. |
| AI Tutor UI | ❌ None. Backend endpoint exists and is tested. |
| Source-Grounded Lessons UI | ❌ `App.tsx` is the stock Vite template (counter, Vite/React links). `/api/lessons/generate` exists, tested. |
| Quiz & Review UI | ❌ None. API + SRS-ish scheduling logic in `useLessons.updateReview` exist but nothing renders them. |
| Offline Support (download, service worker) | ❌ **not implemented** — no `manifest.webmanifest`, no service worker, no `public/` icons beyond `favicon.svg`/`icons.svg`; IndexedDB layer exists but is unused (and F-3 breaks downloads). |
| Guest-first local storage | ⚠️ DB schema + hooks exist (`src/db/`, `src/hooks/`) but are wired to no component. |
| PWA installability | ❌ `index.html` has no `<link rel="manifest">`, no theme-color, no apple-touch-icon. |

The frontend is ~0% feature-complete: it is the untouched Vite `react-ts`
template with an undisclosed scaffolding area added under `src/services`,
`src/hooks`, `src/db`, `src/types`, `src/utils`. None of it is imported by
`App.tsx`.

---

## 8. Dependency and Configuration Observations

- **`frontend/package.json`** — declares only `react`, `react-dom`
  (deps) and Vite/TS/Oxlint tooling. Missing: `dexie`, `dexie-react-hooks`
  (imported by source); `react-router(-dom)`, `lucide-react` (present in
  `node_modules`, not imported yet). **Lockfile does not contain dexie.**
- **`node_modules` corruption** — `npm install react-router-dom dexie
  dexie-react-hooks lucide-react` (10 Oct 23:16:54) left a debug log ending
  mid-download with no exit line; every package tarball's files were extracted
  except declarations (dexie's `dist/*.d.ts` are absent and
  `dexie-react-hooks` has no `types` directory). The install never saved to
  `package.json`/lock. `node_modules` is therefore a partial, un-tracked
  state; **`npm ci` will break the build**, and even `npm install` may prune
  the needed packages.
- **`tsconfig`** — `erasableSyntaxOnly: true` (`tsconfig.app.json:22`) conflicts
  with the class parameter property in `api.ts` (F-1). `noUnusedLocals` /
  `noUnusedParameters` are enabled. Types for node/vite are correctly set up.
- **Backend pins** — all `requirements.txt` packages are installed and the
  suite runs green. `pytest-asyncio` emits a deprecation warning:
  `asyncio_default_fixture_loop_scope` unset (`conftest.py` should set it).
- **`.oxlintrc.json`** — minimal (rules-of-hooks + only-export-components);
  type-aware linting (`oxlint-tsgolint`) recommended but not enabled.
- **No `.env`, no `VITE_API_URL`** — frontend defaults to
  `http://localhost:8000`, matching the backend default port.
- **README** — architecture/cors/rate-limit claims are aspirational (see §7,
  B-1). Quick-start commands are correct, but "PWA" bullets are unimplemented.

---

## 9. Commands Executed (read-only) and Results

| Command | Exit | Result |
|---|---|---|
| `git status` / `git log` (root) | 128 | Not a git repository |
| `node_modules\.bin\tsc.cmd --noEmit -p tsconfig.app.json` | **2** | 6 errors — F-1, F-2 (incl. cascades). Reproduces Session 1's 11:50 `npm run build` failure |
| `node_modules\.bin\oxlint.cmd src` | 0 | 1 warning (`react/purity` at `usePreferences.ts:41`) |
| `venv\Scripts\python.exe -m pytest -q` | **0** | **27 passed in 3.94s** (DEPRECATION: asyncio_default_fixture_loop_scope) |
| `Invoke-WebRequest registry.npmjs.org/dexie` | 200 | 3514 ms |
| `Invoke-WebRequest en.wikipedia.org/api/rest_v1/...` | 200 | 447 ms |
| Process scans (`Get-Process`, `Get-CimInstance`) | 0 | No node/npm/python/uvicorn running |
| `npm run lint` (this morning, npm log) | 0 | pass (11:49:56) |
| `npm run build` (this morning, npm log) | 2 | fail (11:50:00) — consistent with our tsc reproduction |

**NOT RUN** (per safety rules): `npm install` (would mutate lockfile/
node_modules... it is dispositioned as the likely culprit), `vite build` /
`npm run dev` (competing build/dev server), any Gemini/paid API call, any
database or migration tooling.

---

## 10. Tests — Passed / Failed / Not Run

- **Backend: 27/27 PASSED** (`python -m pytest -q`, 3.94s). Covers health,
  discover/feed, lessons/generate, quiz, evaluate, tutor, and all MockProvider
  paths — including live (read-only) Wikipedia lookups.
- **Frontend:** no test framework installed (no `vitest`, no tests). **NOT
  RUN/N/A.**
- **Type check:** FAILED (6 errors above) — the frontend build is broken.
- **Lint:** PASSED (1 warning).
- Tests that would exercise the Gemini provider against a real key: **NOT RUN**
  (would incur paid API usage).

---

## 11. Recommended Fixes (by priority)

1. **P0 — No P0 findings.** (No confirmed data-loss/critical security defect.
   Note: the missing git repo is the closest thing to an operational
   P0/preventive item — `git init` + initial commit is strongly advised.)
2. **P1 — Make the frontend build:** add missing deps to `package.json`
   (`dexie`, `dexie-react-hooks`; commit `react-router-dom`/`lucide-react`
   when the UI uses them), reinstall cleanly (fixes the missing `.d.ts`),
   and replace the `public status` parameter property in `api.ts:8`.
3. **P1 — Decide whether to keep the offline/DB layer:** if kept, fix
   `useLessons.ts:14` (`equals(1)` → `equals(true)`/filter) and add a test.
4. **P2 — Enforce rate limiting** on AI-facing routes
   (`@limiter.limit(settings.rate_limit)` on `/api/lessons/*`,
   `/api/tutor/chat`, `/api/discover/feed`); remove the unused `Limiter` in
   `discover.py`.
5. **P2 — Harden the Gemini path:** run the client call off the event loop
   (or use the async SDK) and set an explicit timeout.
6. **P2 — Create the git repo** (`git init` at root; add a `.gitignore` is
   already present) so future work is diffable/revertible.
7. **P3 — Cleanups:** dead `source_urls` (lessons.py:59), placeholder
   `SourceSearchResponse`, duplicate domain-color maps, sanitize exception
   `detail` strings, set `asyncio_default_fixture_loop_scope`, fix the
   impure `Date` in `usePreferences`.
8. **P3 — Docs sync:** either implement PWA (manifest + SW + icons) or mark the
   README features as planned; set a real `<title>`; remove the "rate limiting"
   claim until enforced.

---

## 12. Suggested Next Implementation Task

**Tier 1 (unblock):** Get `npm run build` green — add the missing dependencies
to `package.json`, run a clean `npm install`, fix `api.ts` TS1294, and re-run
`npm run build`. This is the single highest-leverage task and directly
unblocks every frontend feature (the entire UI is currently the template).

**Tier 2 (after build is green):** Replace the stock `App.tsx` with the
Discovery Feed screen (mock provider data is available immediately), followed
by the lesson reader.

---

## 13. Uncertainties and Limitations

- **Session 1's terminal is not observable.** Phase 1 conclusions are based on
  system artifacts (npm debug logs, caches, process scans); we did not inspect
  opencode's internal session/conversation storage (privacy boundary of this
  audit).
- **Whether the interactive `npm install` (11:49) is currently blocked** is
  unknown; no npm process existed at scan time, but Session 1 may operate in an
  environment separate from this machine.
- `node_modules` state was inferred from file presence + npm debug logs; an
  interrupted install is the best-fit explanation but the log could also have
  been truncated by rotation (`logs-max:10`).
- No load/performance, accessibility, or mobile-layout testing was possible —
  there is no UI to test (template only).
- All "security" claims are static-analysis based; no live penetration testing
  was performed.
- Total audit ran exclusively in read-only mode; the only side effects are the
  creation of this report and pytest's own cache files.

---

## 14. Handoff for Session 1 and Antigravity

**For Session 1:**
- Your last recorded command, `npm run build`, **failed (exit 2, 11:50)** — it
  did not hang. The failure is reproducible and fully diagnosed (§4): the
  parameter-property TS error and the incomplete `node_modules` (interrupted
  install of `dexie` etc.). The backend is green — `pytest` passes 27/27.
- Please add `dexie` + `dexie-react-hooks` to `package.json` and fix
  `api.ts:8` before further frontend work; the extra packages (`react-router`,
  `lucide-react`) are un-tracked in the manifest.
- **Do not** re-run `npm install` at the same time as this audit is not needed;
  we are done — proceed normally. Nothing of yours was modified.
- If your environment makes npm slow (registry takes 3.5–58s/request here),
  prefer `npm install --prefer-offline` so lookups hit the local cache.

**For Antigravity / next sessions:**
- Read §4 (confirmed bugs) and §11 (fix order) first — do not trust the
  README's feature claims; the frontend is a template, the PWA does not exist,
  and rate limiting is wired but inert.
- The repo is **not under git** — initialize version control before further
  edits so changes can be reviewed.
- Recommended entry point: the "Make `npm run build` green" task (§12).

**For the user:**
- Provide the current tail of Session 1's terminal (or a screenshot) to settle
  the "stuck" question definitively.
- Approve the fix list in §11 before any implementation begins.

— End of audit report —