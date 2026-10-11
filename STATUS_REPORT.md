# ClassBreak — Full Status Report (2026-10-11)

**Author:** OpenCode (recovery/continuation session)
**Scope:** Everything found, fixed, built, verified — and everything still open.
**Repo state at writing:** branch `main`, all work committed, no servers running.

---

## 0. TL;DR

ClassBreak was taken over mid-flight: the **backend was complete and green**,
but the **frontend was the untouched Vite template** with an unbuildable
dependency state and zero UI — despite a README describing a finished PWA.
This session: established Git + shared engineering memory, repaired the
frontend build, **implemented the entire core learning loop UI**, added PWA
scaffolding, and verified everything end-to-end in a real browser against the
running backend (mock AI). One new external defect was discovered (Wikipedia
decommissioned an API the backend relies on). Two decisions remain blocked on
you (§6).

---

## 1. What existed before this session (verified facts)

### Backend — complete and working (Antigravity's work)
- FastAPI app (`backend/app/`): routers for health, discover feed, lesson
  generation, quiz generation, answer evaluation, tutor chat, Wikipedia source
  search. Pydantic validation everywhere, CORS restricted, generic exception
  handler, slowapi installed.
- AI abstraction (`ai_provider.py`) with `GeminiProvider` (google-genai,
  `gemini-2.0-flash`, key strictly server-side) and `MockProvider` (rich,
  clearly-labeled deterministic fixtures). Selection via `AI_PROVIDER` env.
- Wikipedia grounding (`source_manager.py`), prompt templates (`prompts.py`).
- **27 pytest tests, all passing** — cover every route + the mock provider.
- Guest-first/privacy architecture: **no database, no auth, no server-side
  user data by design** (all user state lives client-side).

### Frontend — infrastructure only, no application
- Antigravity had written (but never wired into any UI): API client
  (`services/api.ts`), Dexie/IndexedDB schema (`db/database.ts`), hooks
  (`useLessons` with SM-2-lite scheduling, `usePreferences`,
  `useOnlineStatus`), full type definitions, helper utilities.
- `App.tsx` was still the stock Vite counter demo. No components, no pages,
  no router, no PWA (manifest/service worker), no markdown rendering.
- **The build was broken** (6 TS errors) and `node_modules` was corrupt: an
  interrupted `npm install` (from 10 Oct, confirmed by npm debug logs) had
  extracted `dexie`/`react-router`/`lucide-react` partially (no type
  declarations) without ever updating `package.json`/lockfile.
- README.md described features (PWA, offline, rate limiting) that did not
  exist — documentation was aspirational.

### Process/infrastructure facts
- **Not a Git repository.** No coordination docs. No `.env` (no secrets
  anywhere — verified). No backend venv installed.
- A second agent ("Session 2") ran a **read-only audit** in the same workspace
  (`AUDIT_REPORT.md`) whose findings cross-validated this report's; one of my
  own initial claims (Dexie boolean index → `DataError`) was corrected against
  it: boolean values are silently *excluded* from indexes instead.

---

## 2. What was completed this session (with evidence)

### A. Engineering memory + version control
- Created `AGENTS.md` (conventions, security rules, coordination protocol),
  `PROJECT_STATUS.md`, `TASKS.md`, `HANDOFF.md` — the four shared files both
  agents must use. `AUDIT_REPORT.md` preserved.
- `git init` (branch `main`) + **4 commits**, clean tree at handoff.

### B. Build-foundation repair (commit `2f4e7e7`)
- Added `dexie@4`, `dexie-react-hooks@1`, `react-router-dom@7`, `lucide-react`
  to package.json; clean `npm install --prefer-offline` → lockfile +
  node_modules consistent, missing type declarations restored.
- `api.ts` TS1294 (constructor parameter property) → explicit field.
- Dexie schema: removed invalid boolean indexes (`isDownloaded`, `synced`);
  `useLessons` now uses `.filter()` — the old `where().equals(1)` query could
  never match anything (index entries for boolean values don't exist).
- `usePreferences`: no more impure `Date` in render (module-level defaults);
  `update()` → `put()` closes the race where updates silently no-oped before
  `ensureDefaults` ran.
- **Evidence:** `npm run lint` clean, `npm run build` green.

### C. The complete core-loop UI (final commit) — mobile-first, dark-mode-aware
| Feature | Implementation | Verified how |
|---|---|---|
| App shell | Bottom tab nav (Discover/Saved/Review/Settings), sticky header, online/offline badge, scroll restoration | Live browser |
| Discover feed | `POST /discover/feed` with interests/exclusions/feed-history; domain+difficulty chips; refresh; "Learn this" → lesson generation | Live: 10 mock items, feed 200s in server log |
| Lesson reader | Auto-saved to IndexedDB; XSS-safe markdown renderer (escape-first); key points, examples, takeaways, **sources**, related-topic chips → generates next lesson; download-for-offline toggle; delete | Live: full lesson rendered after generate 200 |
| Quiz | 5-question generation (mock serves 3); MC answered locally (free/exact), open-ended via `/lessons/evaluate`; per-question feedback + explanations; progress bar; results screen; attempt persisted; **SRS reschedule** | Live: answered 3 questions, 33% result + "come back sooner" copy |
| Saved library | Live-query list, read/download-toggle/delete, offline badge | Live: lesson present, actions rendered |
| Review (spaced repetition) | Due list, "Remembered it / Need another pass" → SM-2-lite interval+ease update, upcoming count, empty states | Live: "All caught up — 1 lesson scheduled for later" after quiz |
| Tutor chat | Lesson context, last-10-message history, markdown answers, follow-up suggestion chips, offline guard | Live: message → 200 → markdown reply + 3 chips |
| Settings | Interest chips (16 domains), default lesson length, live `/api/health` status showing provider ("mock" + how to enable real), privacy note | Live: "Connected · version 0.1.0 · AI provider: mock" |
| PWA | `manifest.webmanifest`, SVG icon, `sw.js` caching **static assets only** (never `/api/`, never cross-origin, SPA navigation fallback), PROD-only registration, viewport-fit/theme-color metadata | Build green; runtime offline behavior **unverified** (headless env) |
| Styling | CSS-variable design tokens, light + `prefers-color-scheme` dark, safe-area insets, 640px max-width layout | Build green; rendering confirmed in browser |

- New files: `src/pages/*` (7 pages), `src/services/lessonStore.ts`,
  `src/services/generateLesson.ts`, `src/utils/markdown.ts`,
  `src/components/Markdown.tsx`, `public/{manifest.webmanifest,icon.svg,sw.js}`;
  rewrote `App.tsx`, `App.css`, `index.css`, `main.tsx`, `index.html`.

### D. End-to-end verification (evidence summary)
- Backend `uvicorn` (mock provider) + frontend **production build** via
  `vite preview`, driven by browser automation:
  Discover → generate → read → quiz (answer/feedback/results/reschedule) →
  Saved → Review → Settings → Tutor. **Zero console errors the entire run.**
- Backend log during the run confirmed every API call returned 200 and
  Wikipedia's summary endpoint responded live.
- Both servers were stopped afterwards; no processes left running.

---

## 3. New defect discovered this session

- **Wikipedia `/page/related/{query}` is decommissioned** (HTTP 403, Wikimedia
  T376297) — the secondary grounding path in `source_manager.py` is dead.
  The app degrades gracefully (primary `/page/summary/` still works, 200), but
  lessons are now grounded on a **single source** instead of up to three.
  Task + fix proposal (Wikipedia opensearch + extracts API) filed in TASKS.md.
- Minor observations: an external probe hits backend `/health` (not
  `/api/health`) repeatedly → harmless 404s; during automated UI clicking two
  extra test lessons were generated (test-profile data only, no repo impact).

---

## 4. What remains — remaining work (all tracked in TASKS.md)

### High priority
1. **Replace the decommissioned Wikipedia `/page/related/` call** (restore
   multi-source grounding; add a recorded-fixture test).
2. **Apply rate limiting** — slowapi is installed and wired but **no route has
   a `@limiter.limit` decorator**; cost control is inactive. Do this *before*
   any real API key is configured.
3. **Enforce citation honesty server-side** — filter AI-suggested references
   against actually-fetched sources (currently prompt-only guidance).
4. **PWA runtime verification (marked REVIEW)** — service-worker registration,
   installability, and offline reading of downloaded lessons need a visible
   browser or real Android device; the headless environment couldn't verify.

### Medium
5. Gemini provider: use async SDK (`client.aio`) + explicit timeout (currently
   blocks the event loop; untestable without key).
6. Diversify mock lessons (one fixed fixture regardless of topic).
7. Sanitize exception `detail` strings; silence pytest-asyncio deprecation.
8. README sync (root README overstates offline/PWA; `frontend/README.md` is
   still the stock Vite template).

### Later
9. Frontend automated tests (quiz scoring, SRS, markdown XSS cases); CI.
10. Bundle optimization (399 kB JS — lazy route chunks), dark-mode visual QA,
    accessibility pass, real-Android test; persist per-question quiz answers
    (attempts currently store `answers: []`).

### Blocked on your decision (§6)
- PostgreSQL/auth vs. documented local-first design.
- Real Gemini key for live AI verification (no paid calls without approval).

---

## 5. How to run it right now

```bash
# Terminal 1 — backend (mock AI, no key needed)
cd backend
venv\Scripts\uvicorn app.main:app --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev        # http://localhost:5173
# or: npm run build && npm run preview   # production build on :4173
```

---

## 6. Decisions I need from you

1. **Data architecture:** the spec mentioned PostgreSQL + authentication, but
   the implemented + documented design is deliberately guest-first/local-first
   (no server-side user data). I preserved it. Keep it for now (recommended —
   matches privacy priorities and current scope), or plan an accounts phase?
2. **Real AI:** everything runs on the clearly-labeled mock provider. If you
   want live Gemini, create `backend/.env` from `.env.example` and set
   `GEMINI_API_KEY` (I will not enable paid calls without your say-so).
   Rate limiting should land first (task 2 above).
