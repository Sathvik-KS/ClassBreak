# PROJECT_STATUS.md — ClassBreak

Last updated: 2026-10-11, end of OpenCode recovery + core-loop implementation session.

## 1. What currently works (verified)

### Backend (`backend/`) — VERIFIED WORKING (unchanged this session)
- FastAPI app; routes: `/api/health`, `/api/discover/feed`,
  `/api/lessons/generate`, `/api/lessons/quiz`, `/api/lessons/evaluate`,
  `/api/tutor/chat`, `/api/sources/search`.
- AI provider abstraction: `GeminiProvider` (server-side key only) /
  `MockProvider` (deterministic, labeled mock). `AI_PROVIDER=auto|gemini|mock`.
- Wikipedia source grounding, Pydantic validation, CORS restriction,
  generic exception handler.
- **Tests: 27/27 pass** (`venv\Scripts\python -m pytest tests -q`, 4.26s).
- Live-run verified 2026-10-11 (uvicorn + mock provider): health, feed,
  lesson generate, quiz, tutor all returned 200 during browser E2E test.

### Frontend (`frontend/`) — CORE LOOP BUILT AND VERIFIED
- **`npm run lint` clean; `npm run build` green** (tsc -b && vite build ~4-6s;
  bundle 399 kB JS + 10 kB CSS, 127/2.9 kB gzip).
- Mobile-first UI, bottom tab navigation, react-router-dom routes:
  `/` Discover feed, `/lesson/:id`, `/quiz/:id`, `/tutor/:id`,
  `/saved`, `/review`, `/settings`.
- All pages verified live in a browser against the production build
  (vite preview) + mock backend on 2026-10-11 — see TASKS.md evidence lines:
  feed → generate lesson → read → quiz (feedback/results/SRS reschedule) →
  saved library → review scheduling → settings (interests/backend status) →
  tutor chat with follow-up chips. **Zero console errors.**
- IndexedDB (Dexie) persistence: lessons auto-saved on generation, download
  toggle for offline, quiz attempts, SM-2-lite review scheduling, preferences,
  bounded feed history.
- Safe markdown renderer (escape-first, XSS-safe) for AI content.
- PWA scaffolding: manifest, SVG icon, service worker (static-asset-only
  caching; never caches /api/; SPA navigation fallback), PROD-only registration.
  ⚠️ Runtime offline behavior NOT yet verified (headless env) → TASKS "REVIEW".
- Theme: light/dark via `prefers-color-scheme`; CSS-variable design tokens.

## 2. What is partially implemented or broken

- **Wikipedia `/page/related/` is decommissioned (403, T376297)** — found in
  live backend logs 2026-10-11. `source_manager.py` silently falls back, so
  lessons still generate but grounded on only ONE source (the summary endpoint,
  which still works). Replacement task in TASKS.md.
- Rate limiting configured but **not applied to any route** (slowapi decorators
  missing) — cost control inactive with a real key.
- AI lesson references not enforced against fetched sources (fabricated-citation
  guard is prompt-only; `source_urls` dead code in lessons.py:59).
- `GeminiProvider` uses sync SDK call in async context (blocks event loop; no
  client timeout). Untestable without a key → unverified.
- Mock lesson is a single fixed fixture regardless of topic; mock quiz = 3 fixed
  questions.
- Quiz attempts persist with `answers: []` (score + questions only).
- Repeated `GET /health` 404s observed in uvicorn log — an external probe
  (NOT the frontend, which calls `/api/health` correctly). Harmless; noted.
- README.md overstates offline/PWA as shipped (PWA scaffold now exists but
  offline behavior unverified). `frontend/README.md` is the stock Vite template.

## 3. Dependencies and setup completed

- `backend/venv` created 2026-10-11 (Python 3.13.1), all requirements installed.
- Frontend: `dexie@4`, `dexie-react-hooks@1`, `react-router-dom@7`,
  `lucide-react` added to package.json + lockfile; node_modules consistent
  (was corrupt from an interrupted Antigravity-era install).
- Git initialized 2026-10-11 (was not a repo). Branch `main`, 4 commits,
  clean tree at handoff.

## 4. Checks run and results (2026-10-11)

| Check | Result |
|---|---|
| `backend: pytest tests -q` | ✅ 27 passed (4.26s) |
| `frontend: npm run lint` | ✅ clean (after fixes) |
| `frontend: npm run build` | ✅ passes |
| Browser E2E (prod build + mock backend) | ✅ full core loop, 0 console errors |
| Wikipedia `/page/summary/` | ✅ 200 (live) |
| Wikipedia `/page/related/` | ❌ 403 decommissioned (new bug, task filed) |

## 5. Missing environment variables (names only — no secrets)

- `backend/.env` does not exist → app runs in **mock AI mode**. To enable real
  AI: copy `backend/.env.example` → `.env`, set `GEMINI_API_KEY` (requires
  explicit user approval per AGENTS.md — no paid calls otherwise).
- Frontend: `VITE_API_URL` optional (defaults `http://localhost:8000`).

## 6. Architectural decisions and technical debt

- **Preserved decision:** no PostgreSQL / no auth / no server-side user data —
  documented privacy-first, guest-first design. Open decision tracked in
  TASKS.md (BLOCKED on user).
- **Concurrent-agent note:** "Session 2" auditor's read-only findings
  (`AUDIT_REPORT.md`) cross-validated and folded in; one correction absorbed
  (Dexie booleans are excluded from indexes silently — no DataError).
- Tech debt (details in TASKS.md "Backend hardening" + "Later"): rate limiting,
  citation enforcement, Gemini async, mock diversity, Wikipedia related-API
  replacement, frontend tests, CI, bundle size, quiz answer persistence.
