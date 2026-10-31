# AGENTS.md — ClassBreak Engineering Guide

This is the single canonical engineering document for ClassBreak. It replaces
the previous `PROJECT_STATUS.md`, `HANDOFF.md`, `TASKS.md`, `STATUS_REPORT.md`,
`AUDIT_REPORT.md`, `frontend/README.md`, and `mobile/README.md`. The root
`README.md` is intentionally kept as a short human-facing introduction and
points here for authoritative details. If project facts change, update this
file instead of creating competing status/handoff documents.

**Every coding agent (OpenCode, Antigravity, or human) must read this file and
inspect the relevant source before changing anything.** Do not trust old
claims or assume a feature is finished because it is described here; verify it
in code first.

Status snapshot: backend dependency/setup validation on **2026-10-31** against
**Python 3.14.4**. Latest commit at that time was `95d187b` (documentation
consolidation). Runtime results quoted below are the last recorded evidence;
the backend results in §12 were rerun on the validation machine on 2026-10-31.

---

## 1. Product overview

ClassBreak is a mobile-first personal learning app for short breaks. Its
learning loop is:

**Discover → Understand → Explore Deeper → Remember → Connect**

The intended experience:

- Discover interesting topics through a personalized feed.
- Generate a readable, source-grounded lesson.
- Ask an AI tutor follow-up questions about that lesson.
- Take a quiz and get explanations.
- Save lessons and review them later with spaced repetition.
- Keep learning content available offline on the device.

Priorities: excellent Android/mobile-web experience, fast startup, low memory,
readable lessons, AI-assisted explanations grounded in reliable sources,
quizzes, revision, saved lessons, offline access to saved content, guest-first
onboarding, privacy, server-side AI credentials, and controlled AI cost.

The app is deliberately **guest-first and local-first**: no account, no
server-side user database, and no server-side user data. All user learning data
lives on the device (IndexedDB on web, AsyncStorage on mobile).

---

## 2. Repository layout

```text
ClassBreak/
├── AGENTS.md                  # This file — canonical engineering guide
├── README.md                  # Short human-facing introduction
├── .gitignore                 # Ignores .env*, venv, node_modules, build output
├── backend/                   # FastAPI AI proxy + Wikipedia source manager
│   ├── .env.example           # Environment template (no secrets)
│   ├── requirements.txt       # Pinned Python dependencies
│   ├── pytest.ini             # pytest / pytest-asyncio configuration
│   ├── app/
│   │   ├── main.py            # FastAPI app, /api/health, CORS, body guard, 429 handler
│   │   ├── config.py          # Pydantic settings + provider resolution
│   │   ├── rate_limit.py      # Shared slowapi limiter
│   │   ├── models/            # Pydantic request/response models
│   │   ├── routers/           # discover, lessons, tutor, sources
│   │   └── services/          # AI provider abstraction, Gemini, mock, Wikipedia
│   └── tests/                 # 12 test modules + recorded Wikipedia fixtures
├── frontend/                  # React 19 + TypeScript + Vite web/PWA client
│   ├── package.json
│   ├── public/                # manifest, icons, service worker
│   └── src/
│       ├── pages/             # 7 route screens
│       ├── components/        # Markdown renderer
│       ├── db/                # Dexie IndexedDB schema
│       ├── hooks/             # lessons, preferences, online status
│       ├── services/          # HTTP client, lesson persistence
│       ├── types/             # TypeScript mirrors of backend models
│       └── utils/             # markdown, helpers, constants
└── mobile/                    # Expo SDK 57 Android-first React Native app
    ├── LICENSE                # Expo template MIT notice (do not delete)
    ├── app.json               # Expo configuration
    ├── package.json
    └── src/
        ├── app/               # Expo Router file-based screens
        ├── components/        # lesson, markdown, themed UI, tabs
        ├── constants/         # theme tokens
        ├── hooks/             # color scheme/theme
        ├── services/          # HTTP client, AsyncStorage lesson store
        ├── types/             # TypeScript mirrors of backend models
        └── utils/             # pure helpers + review scheduler + tests
```

The `/api/health` endpoint is defined inline in `backend/app/main.py`; there is
no `routers/health.py` module. The other API routes live under
`backend/app/routers/`.

There is **no root LICENSE**. `mobile/LICENSE` is the Expo template's MIT
notice, not a license for the ClassBreak application. Treat the project as
private/unlicensed unless the user explicitly says otherwise.

No CI configuration exists (no `.github/workflows`, no other pipeline files).

---

## 3. Architecture

```text
Web browser (React 19 + Vite PWA) ──JSON/HTTP──┐
                                                ├──> FastAPI backend
Expo mobile app (React Native) ─────JSON/HTTP──┘
                                                       │
                              ┌────────────────────────┼──────────────────────┐
                              v                        v                      v
                     AIProvider abstraction     Wikipedia APIs         No database
                     ├─ GeminiProvider          (REST summary +
                     └─ MockProvider             MediaWiki opensearch/extracts)
```

Key properties:

- The backend is a **stateless AI proxy + source manager**. It stores nothing
  about users.
- The frontend and mobile app never receive AI credentials.
- The backend exposes JSON APIs under `/api/*`; both clients share the same
  contract.
- The web app stores all user data in **IndexedDB via Dexie**.
- The mobile app stores all user data in **AsyncStorage**.
- AI access is abstracted behind `backend/app/services/ai_provider.py`.
- Wikipedia grounding is best-effort. Failures degrade to fewer sources rather
  than failing the lesson request.
- There are no accounts, sessions, cookies, or authentication.

### Request flow for a lesson

1. Client sends `POST /api/lessons/generate` with a topic, duration, depth, and
   optional interests.
2. Backend fetches Wikipedia material through `source_manager.search_wikipedia`.
3. The source text is formatted into the AI prompt context.
4. The selected provider (`GeminiProvider` or `MockProvider`) returns raw JSON.
5. Backend validates the shape with Pydantic, structurally validates citations,
   and returns a `LessonResponse`.
6. Web: lesson is saved to IndexedDB automatically. Mobile: the user can tap
   Save, or the lesson is saved when a quiz finishes.
7. Quiz/tutor/related-topic actions make further API calls as needed.

---

## 4. Backend (`backend/`)

### 4.1 Stack

- Python target: **3.14** (validated on **3.14.4** on Linux x86_64). Python
  3.13 and older are not part of the validated setup.
- FastAPI `0.115.6`, Uvicorn `0.34.0`, Pydantic `2.12.5` (with
  pydantic-core `2.41.5`), pydantic-settings `2.7.1`, httpx `0.28.1`,
  google-genai `1.14.0`, slowapi `0.1.9`, python-dotenv `1.0.1`.
- Tests: pytest `8.3.4`, pytest-asyncio `0.25.0`, anyio `4.8.0`.
- Pydantic `2.12.5` is the validated Python 3.14 version. Pydantic `2.10.4`
  pulls pydantic-core `2.27.2`, which has no cp314 wheel and fails while trying
  to build with Rust/maturin.
- All required distributions resolve to binary wheels on CPython 3.14 for
  Linux x86_64 and Windows x86_64. No Rust, C compiler, or maturin is needed on
  those platforms. `uvloop` has no Windows wheel, but Uvicorn's
  `sys_platform != "win32"` marker skips it there.
- Known Python 3.14 deprecation warnings: FastAPI/Starlette/slowapi use
  `asyncio.iscoroutinefunction`, pytest-asyncio uses
  `asyncio.get_event_loop_policy`, and anyio `4.8.0` emits a `SyntaxWarning`.
  These are warnings only; the suite passes. The versions were deliberately not
  upgraded during the compatibility fix.
- `pytest.ini` sets `asyncio_default_fixture_loop_scope = function`.

### 4.2 Routes

All routes return JSON. Errors use FastAPI's `{"detail": ...}` contract.

| Method | Path | Purpose | Rate limit |
|---|---|---|---|
| GET | `/api/health` | Health + effective provider + version | Deliberately exempt |
| POST | `/api/discover/feed` | Generate discovery feed | `RATE_LIMIT` (default 30/min) |
| POST | `/api/lessons/generate` | Generate a lesson | `RATE_LIMIT` |
| POST | `/api/lessons/quiz` | Generate quiz questions | `RATE_LIMIT` |
| POST | `/api/lessons/evaluate` | Evaluate an open-ended answer | `RATE_LIMIT` |
| POST | `/api/tutor/chat` | Tutor chat turn | `RATE_LIMIT` |
| GET | `/api/sources/search?q=...` | Wikipedia source search | `RATE_LIMIT_READ` (default 60/min) |

FastAPI's default docs endpoints (`/docs`, `/openapi.json`) are available
because they are not disabled. `/api/health` is defined inline in
`backend/app/main.py`; the remaining routes live in `backend/app/routers/`.

### 4.3 Request validation (Pydantic models)

- `LessonGenerateRequest`: `topic` 1–200 chars; `duration_minutes` 2–15
  (default 5); `depth` one of `beginner|intermediate|advanced`; `interests`
  list.
- `FeedRequest`: `interests`, `excluded_topics`, `history_ids`; `count` 1–30
  (default 10).
- `QuizGenerateRequest`: `lesson_content` 10–10,000 chars; `topic` 1–200;
  `difficulty` pattern; `count` 1–10 (default 3).
- `EvaluateRequest`: `question` and `correct_answer` 1–1000; `user_answer`
  1–2000; `question_type` `multiple_choice|open_ended`.
- `TutorChatRequest`: `lesson_id` optional; `lesson_context` max 5000;
  `messages` list of `{role: user|assistant, content}`; `question` 1–1000.
  The router uses only the **last 10 messages** as context.
- `GET /api/sources/search`: `q` required, 1–200 chars; backend requests up to
  5 sources.

Validation failures return FastAPI's default 422 response. The 100,000-byte
request body guard returns 413 `{"detail": "Request body too large"}`. It checks
the `Content-Length` header only; it does not buffer or inspect chunked bodies.

### 4.4 AI provider abstraction

`backend/app/services/ai_provider.py` defines the abstract `AIProvider` with
five async methods:

- `generate_lesson(topic, interests, depth, duration_minutes, source_context)`
- `generate_feed(interests, excluded, history_ids, count)`
- `tutor_chat(lesson_context, conversation_history, question)`
- `generate_quiz(lesson_content, topic, difficulty, count)`
- `evaluate_answer(question, correct_answer, user_answer, question_type)`

`get_ai_provider()` resolves the provider:

- `AI_PROVIDER=auto` → Gemini if `GEMINI_API_KEY` is set, otherwise mock.
- `AI_PROVIDER=gemini` with no key → mock (safe fallback, never a keyless
  Gemini client).
- `AI_PROVIDER=mock` → mock.
- Unknown value → mock, with a startup warning.

The provider is constructed **per request**. This keeps the interface simple
but is a known inefficiency (a new Gemini client is built for each call).

### 4.5 Gemini provider

`backend/app/services/gemini.py`:

- Model: `gemini-2.0-flash`.
- The Google Gen AI SDK call is synchronous, so it runs in a worker thread via
  `asyncio.to_thread`.
- The call is bounded by `asyncio.wait_for(settings.gemini_timeout)`
  (default 30 s).
- Requests JSON output (`response_mime_type="application/json"`),
  temperature 0.7, `max_output_tokens=4096` hardcoded in the SDK config.
- Invalid/empty JSON becomes a controlled error; routers log the real exception
  server-side and return a generic 502 message.
- **Not verified against the real Gemini API.** No key is present, and paid
  calls require explicit user approval.

### 4.6 Mock provider

`backend/app/services/mock_provider.py` works with no credentials and is the
default when no key is configured:

- 12 fixed feed items across domains.
- A single fixed “Cocktail Party Effect” lesson. For other topics the title and
  summary are retitled with `[MOCK]`, but the sections/examples/takeaways and
  fixed cocktail-party references remain. Fetched Wikipedia sources may be
  appended by citation validation.
- 3 fixed multiple-choice quiz questions.
- Keyword-matching evaluation for open-ended answers.
- Tutor responses are labeled mock text with fixed follow-up suggestions.

Mock content is for development and smoke tests only, not feature demos.

Mock mode removes the AI-key requirement only. It does not make the entire
application independent of the backend, and lesson generation still attempts
Wikipedia source requests (degrading gracefully on failure). Reading saved
lessons is the documented offline capability.

### 4.7 Wikipedia grounding

`backend/app/services/source_manager.py` uses:

- REST `https://en.wikipedia.org/api/rest_v1/page/summary/{query}` for the
  primary article.
- MediaWiki Action API `action=opensearch` to find related titles.
- MediaWiki Action API `action=query&prop=extracts` to fetch intro text.

Behavior:

- 10 s HTTP timeout; custom User-Agent.
- Up to 20 candidate related titles; related extracts capped at 1,000 chars.
- Default lesson grounding requests up to 3 sources; `/api/sources/search`
  requests up to 5.
- Redirects/normalization are resolved; missing pages and empty extracts are
  skipped.
- Any timeout, HTTP error, malformed JSON, or missing article degrades to fewer
  sources; the function never raises for upstream failures.
- The old REST `/page/related/` endpoint is **not used** (decommissioned
  upstream; HTTP 403, Wikimedia T376297).

### 4.8 Citations and grounding honesty

`validate_references()` in `backend/app/routers/lessons.py` performs
**structural** validation against fetched sources:

- Malformed/non-http(s) URLs and duplicate normalized URLs are dropped.
- A URL matching a fetched source gets `source_type="wikipedia"`.
- A structurally valid URL not present in fetched sources gets
  `source_type="provided"` (honest “model-supplied, unverified” label).
- Fetched sources the model did not cite are appended.
- Tutor references are only accepted if they have a title and an
  `http(s)` URL; they are labeled `"provided"`.

This is **not semantic fact-checking**. No claim is verified against the source
text.

### 4.9 Rate limiting, CORS, and errors

- Shared slowapi limiter in `app/rate_limit.py`, keyed by remote address
  (per-IP), scoped per route.
- AI POST routes use `RATE_LIMIT` (default `30/minute`); source search uses
  `RATE_LIMIT_READ` (default `60/minute`).
- `/api/health` is deliberately unlimited.
- 429 responses use `{"detail": "Rate limit exceeded: ..."}` and include a
  best-effort `Retry-After` header.
- The limiter is **in-memory and per-process**: counters reset on restart and
  are not shared across workers/instances. It is single-process cost control,
  not distributed abuse protection.
- CORS: origins from `CORS_ORIGINS` (defaults
  `http://localhost:5173,http://localhost:4173`); no credentials; methods
  `GET` and `POST`; headers limited to `Content-Type`.
- Routers log real exceptions with `logger.exception` and return generic client
  messages (e.g. “Lesson generation failed”, “Feed generation failed”). A
  global handler returns 500 `{"detail": "Internal server error"}`.

---

## 5. Web frontend (`frontend/`)

### 5.1 Stack and commands

- React `^19.2.8`, React DOM `^19.2.8`, TypeScript `~6.0.2`, Vite `^8.3.0`,
  `react-router-dom` `^7.18.4`, `dexie` `^4.4.6`,
  `dexie-react-hooks` `^1.1.7`, `lucide-react` `^1.55.0`.
- Lint: `oxlint` (`npm run lint`).
- Build: `tsc -b && vite build` (`npm run build`).
- No Tailwind. Plain CSS in `src/index.css` and `src/App.css`.
- TypeScript is strict with `erasableSyntaxOnly`, `noUnusedLocals`, and
  `noUnusedParameters`. **Constructor parameter properties are a build error.**

### 5.2 Routes

`BrowserRouter` routes in `src/App.tsx`:

| Path | Screen |
|---|---|
| `/` | Discover feed |
| `/lesson/:id` | Lesson reader |
| `/quiz/:id` | Quiz |
| `/tutor/:id` | Tutor chat |
| `/saved` | Saved library |
| `/review` | Review schedule |
| `/settings` | Interests, default duration, backend status, privacy |
| `*` | Redirect to `/` |

App shell: sticky header with brand + online/offline badge; bottom navigation
with Discover, Saved, Review, Settings; scroll-to-top on route changes. Layout
max width is 640 px; light/dark styling follows `prefers-color-scheme` via CSS
variables. `preferences.theme` exists in IndexedDB but is not currently used to
force a theme.

### 5.3 Web behavior

- **Discover:** calls `POST /api/discover/feed` with preferences, excluded
  topics, and the last 20 feed-history IDs; records shown items in IndexedDB;
  “Learn this” generates and auto-saves a lesson, then navigates to it.
- **Lesson:** reads the saved lesson from IndexedDB; renders sections with a
  safe markdown renderer; shows key points, examples, takeaways, sources,
  related-topic chips; supports download/remove-download, delete, quiz, and
  tutor actions. Related-topic chips generate and save a new lesson.
- **Quiz:** requests 5 questions; multiple-choice answers are checked locally;
  open-ended answers go to `/api/lessons/evaluate`; shows per-question
  feedback/explanations, progress, results, and an in-quiz error banner for
  evaluation/429 failures. Quiz attempts are persisted.
- **Saved:** live Dexie query of saved lessons; read, download toggle, delete.
- **Review:** due list joined with saved lessons; “Remembered it” / “Need
  another pass” update the SM-2-lite schedule; shows upcoming count/empty
  states.
- **Tutor:** sends lesson context + last 10 messages to `/api/tutor/chat`;
  renders markdown answers and follow-up suggestion chips; disables itself
  offline.
- **Settings:** 16 interest chips, default duration (2/5/10 min), live
  `/api/health` status with provider/version, privacy note. The “backend
  unreachable” message hardcodes `http://localhost:8000` even if
  `VITE_API_URL` is different (minor known issue).

The HTTP client (`src/services/api.ts`) uses `VITE_API_URL` with a default of
`http://localhost:8000`, a 30 s `AbortController` timeout, parses
`{"detail": ...}` errors, and maps timeouts to status 408 and network failures
to status 0.

### 5.4 Web persistence (IndexedDB / Dexie)

Database name: `classbreak`. Tables/indices:

- `preferences`: `id`
- `lessons`: `id, topic, domain, savedAt`
- `quizAttempts`: `id, lessonId, completedAt`
- `reviewItems`: `id, lessonId, nextReviewAt`
- `feedHistory`: `id, feedItemId, timestamp`

Persistence code is split across two files. Inspect both before changing any
saving, deletion, or review behavior:

- `frontend/src/services/lessonStore.ts` owns lesson creation/saving
  (`saveLessonIfMissing`, which also creates the initial 1-day review item),
  download state (`setLessonDownloaded`), deletion (`deleteLessonAndData`,
  which also removes review items and quiz attempts), feed history, and
  `getSavedLesson`.
- `frontend/src/hooks/useLessons.ts` owns the live Dexie queries used by the
  Saved and Review screens, plus its own `saveLesson`, `deleteLesson`, and
  `updateReview`. `updateReview` performs the SM-2-lite advancement used by
  the quiz and review screens.

**Warning:** these two files overlap. Both contain save/delete behavior, and
review advancement is in `useLessons.ts` while initial review creation is in
`lessonStore.ts`. Change and verify them together; editing only one can leave
the UI and stored data inconsistent.

**Critical schema rule:** IndexedDB only supports string/number/date keys.
Boolean fields (`isDownloaded`, `synced`) must **not** be indexed. Boolean
values are silently excluded from indexes (no error), so index queries can
never match them. Query booleans with `.filter()`.

Persistence behavior:

- Generated lessons are auto-saved (`generateAndSaveLesson`).
- Saving creates one review item due in 1 day (`saveLessonIfMissing`).
- “Download for offline” sets `isDownloaded`; the lesson is already in
  IndexedDB, so this is an offline-availability marker used by the UI.
- Deleting a lesson also deletes its review items and quiz attempts.
- Feed history is bounded to 200 rows; the last 20 IDs are sent to the feed API.
- Preferences default row is created via `ensureDefaults()`; updates use
  `put()` to avoid races.
- Quiz attempts persist questions/score/completedAt but currently store
  `answers: []` (see known issues).
- Review scheduling (SM-2-lite, `useLessons.updateReview`): correct → 1 day
  first, 3 days second, then `interval * easeFactor`; ease +0.1 (min 1.3).
  Wrong → 1 day; ease −0.2 (min 1.3).

### 5.5 Web PWA / offline

- `public/manifest.webmanifest` + SVG icon: standalone, portrait, theme color.
- `public/sw.js` caches the static app shell and same-origin static assets.
- The service worker **never caches `/api/*`**, never caches cross-origin
  requests, and never handles non-GET requests.
- Navigations are network-first with a cached `/index.html` fallback; static
  assets are cache-first with background refresh.
- Registration happens only in production builds (`import.meta.env.PROD`).
- Offline reading depends on the app shell being cached. Saved lessons remain
  readable from IndexedDB; quiz/tutor/discovery need the backend.
- **PWA runtime/offline behavior has not been verified on a real device or
  visible browser.** Static review of the service worker is not device proof.

### 5.6 Web markdown/XSS safety

`src/utils/markdown.ts` escapes HTML first, then supports a small subset:
headings, paragraphs, `**bold**`, `*italic*`, `` `code` ``, and `-`/`*` bullet
lists. It does not allow raw HTML. This is used for AI-generated lesson/tutor
content.

---

## 6. Mobile app (`mobile/`)

### 6.1 Stack

- Expo SDK `~57.0.31`, Expo Router `~57.0.29`, React Native `0.86.3`,
  React `19.2.3`, React DOM `19.2.3`, TypeScript `~6.0.3`.
- Android-first; also has iOS and web scripts via Expo.
- Expo Router file-based navigation with `typedRoutes` and `reactCompiler`
  experiments enabled in `app.json`.
- Bottom tabs use `expo-router/unstable-native-tabs` (`NativeTabs`) with
  Android material symbols. This is an unstable Expo API; treat upgrades with
  care.
- Backend URL: `EXPO_PUBLIC_API_URL`, default `http://localhost:8000`.
- 30 s timeout; HTTP errors preserve the backend `{"detail": ...}` message.
- The mobile client performs **runtime shape validation** on every data-bearing
  API response and on lessons restored from storage, turning contract drift
  into a clean error screen instead of a render crash. The exception is the
  simple `/api/health` response, which is a typed cast rather than a runtime
  check.
- External URLs are opened only if `http://` or `https://`
  (`isSafeWebUrl`).

### 6.2 Screens and routes

Expo Router `src/app/`:

| Route | Purpose |
|---|---|
| `(tabs)/index` | Discover feed (`POST /api/discover/feed`, count 10) |
| `(tabs)/saved` | Saved lessons from AsyncStorage |
| `(tabs)/review` | Due/upcoming spaced-repetition list |
| `lesson/[topic]` | Generate and read a lesson |
| `saved/[id]` | Read a saved lesson without an API call |
| `quiz` | 5-question quiz |
| `tutor` | Tutor chat about the lesson |

There is **no Settings screen** on mobile. There are no interest preferences,
excluded topics, or feed-history controls on mobile.

### 6.3 Mobile behavior

- **Discover:** loads 10 feed items, pull-to-refresh, retry/error/empty states;
  tapping a topic generates a lesson with `duration_minutes: 5`.
- **Lesson:** renders title, domain/difficulty, summary, sections, key points,
  examples, takeaways, and sources. Actions: Save/Remove saved, Take quiz, Ask
  the tutor. Related-topic chips are **not** implemented on mobile.
- **Quiz:** requests `count: 5`; multiple choice checked locally; open-ended
  answers evaluated by the backend; progress bar, feedback, model answer,
  results screen with pass threshold 0.6. Finishing a quiz saves the lesson if
  missing and advances its review schedule.
- **Tutor:** lesson is passed as a JSON route param; context is truncated to
  5,000 characters; question max 1,000; follow-up chips fill the composer
  rather than sending immediately; links are http(s)-only.
- **Saved:** lessons are always on-device; removing a lesson also removes its
  review schedule. No separate “download” flag exists.
- **Review:** joins saved lessons with review items; due/upcoming sections;
  “Remembered it” / “Need another pass” / “Re-read”. Orphaned review items are
  skipped.
- Lessons are **not** auto-saved on mobile at generation time; the user taps
  Save, or a quiz can save the lesson.

### 6.4 Mobile persistence (AsyncStorage)

Two JSON lists under fixed keys:

- `classbreak.savedLessons` — `SavedLesson` records (lesson + `savedAt`).
- `classbreak.reviewItems` — one schedule per saved lesson.

`src/services/lessonStore.ts` uses read-modify-write of the whole list. This is
intentionally simple and safe for one user tapping one action at a time; do not
introduce concurrent writers without a locking/migration design. A save creates
a review schedule due in 1 day. The review algorithm matches the web app
(`review-scheduler.ts`). Removing a lesson removes its schedule.

Native route params carry the full lesson JSON for quiz/tutor. On Android the
navigation state is in-memory, so size is acceptable for now. Route params are
treated as untrusted: malformed/missing lesson JSON shows an error screen.

### 6.5 Mobile tests and checks

`npm test` uses Node's native test runner on pure functions only:

- `src/utils/helpers.test.ts`
- `src/utils/review-scheduler.test.ts`

There are no component, navigation, storage-integration, or device tests.
`npm run typecheck` runs `tsc --noEmit`; `npm run lint` runs `expo lint`.
The tsconfig comments assume **Node 24** for native TypeScript test execution;
use a current Node release if the test runner rejects `.ts` files.

---

## 7. Shared API/data contract

Keep these in sync when changing anything:

- Backend Pydantic models: `backend/app/models/lesson.py`,
  `backend/app/models/common.py`.
- Web types: `frontend/src/types/index.ts`.
- Mobile types: `mobile/src/types/index.ts`.

Important shapes:

- `Reference`: `title`, `url`, `source_type`, optional `extract`.
- `Lesson`: `id`, `title`, `summary`, `topic`, `domain`, `difficulty`,
  `duration_minutes`, `sections[]` (`heading`, `content`, `key_points[]`),
  `examples[]`, `takeaways[]`, `references[]`, `related_topics[]`,
  `generated_at`.
- `FeedItem`: `id`, `title`, `hook`, `topic`, `domain`, `difficulty`,
  `estimated_minutes`.
- `QuizQuestion`: `id`, `question`, `options[]`, `correct_answer`,
  `explanation`, `question_type`.
- `AnswerEvaluation`: `is_correct`, `score` (0–1), `feedback`,
  `correct_answer`.
- `TutorResponse`: `answer`, `follow_up_suggestions[]`, `references[]`.
- `GET /api/health` response: an inline object (not a Pydantic model) with
  `status` (string, currently `"ok"`), `ai_provider` (string), and `version`
  (string, currently `"0.1.0"`).
- `GET /api/sources/search` response: an inline object with `sources` (array of
  serialized `Reference` objects) and `extracts` (array of strings).
  `extracts[i]` is the text for `sources[i]`; both come from
  `search_wikipedia()`.

The web `SavedLesson` adds `savedAt` and `isDownloaded`. The mobile
`SavedLesson` adds only `savedAt`.

Errors are JSON with a `detail` field where the app handles them. Application
and upstream errors from these routers commonly return `detail` as a string,
but FastAPI request-validation failures (HTTP 422) use the default shape where
`detail` is an array of error objects. Clients should not assume `detail` is
always a string. Backend routers return 502 with generic messages for
upstream/generation failures; oversized `Content-Length` is 413; rate limit is
429 with `Retry-After`; unexpected errors are 500.

---

## 8. Persistence, caching, and offline summary

| Concern | Web | Mobile |
|---|---|---|
| User data store | IndexedDB (Dexie), database `classbreak` | AsyncStorage JSON lists |
| Saved lessons | `lessons` table; auto-saved on generation | `classbreak.savedLessons`; saved on tap or quiz finish |
| Review schedule | `reviewItems` table | `classbreak.reviewItems` |
| Quiz history | `quizAttempts` (answers currently empty) | Not stored; only review schedule advances |
| Feed history | `feedHistory`, bounded to 200 | Not stored |
| Offline lesson reading | Saved lesson data + cached app shell; `isDownloaded` marks availability | Saved lesson data; always local |
| API caching | Never cached by the service worker | No response cache |
| Offline discovery/quiz/tutor | Requires network | Requires network |

Clearing browser/app data deletes the user's learning history. There is no
export, backup, sync, or account recovery.

---

## 9. Auth, privacy, security, and limitations

### Deliberate design

- **No accounts, no auth, no server-side user database.** This is a
  privacy-first, guest-first decision, not an oversight. Do not add
  PostgreSQL/auth/accounts without explicit user approval.
- The backend is stateless; it keeps no user data between requests.
- AI credentials stay in backend environment variables. Neither client ever
  receives them.

### Security properties

- `.env` files are gitignored (`.env`, `.env.*`, except `.env.example`).
  `frontend/.gitignore` ignores `*.local`; `mobile/.gitignore` ignores
  `.env*.local`. No secrets or `.env` files are present in the repository.
- `VITE_*` and `EXPO_PUBLIC_*` values are compiled into client bundles and are
  **public**. Only backend URLs belong there; never keys or tokens.
- CORS is restricted to configured origins; credentials are disabled; only GET
  and POST are allowed.
- The service worker never caches API responses or cross-origin requests.
- The web markdown renderer escapes HTML first; mobile renders markdown as
  native text components rather than raw HTML.
- Backend citation validation only accepts http(s) URLs; mobile additionally
  refuses non-http(s) links before opening them.
- Real AI calls are expensive. Rate limiting must remain enabled on all
  AI-facing routes, and real paid calls require explicit user approval.

### Limitations and residual risks

- The API is **unauthenticated**. Rate limiting is the only abuse control and
  is in-memory/per-process/single-instance. A public deployment with a real key
  needs stronger protection (auth, gateway limits, or both).
- The request body guard checks `Content-Length` only; chunked bodies are not
  covered.
- Prompt injection is possible: user topics/interests/history are interpolated
  into prompts. System prompts instruct grounding, but that is not a hard
  security boundary.
- Citation validation is structural only, not semantic fact-checking.
- AI output may be wrong, incomplete, or inconsistent; the UI labels mock and
  unverified content, but users should not treat it as authoritative.
- No server-side rate-limit persistence: restarting the backend resets
  counters; multiple workers do not share them.
- No production HTTPS setup is included. Local `http://` is for development;
  a real mobile/production deployment must use HTTPS and configure CORS.
- No secrets management beyond environment variables is implemented.

---

## 10. Environment variables and configuration

Never commit real values. Use `backend/.env.example` as the template and keep
secrets out of docs, logs, and client bundles.

### Backend (`backend/.env`, loaded by pydantic-settings)

| Variable | Default | Notes |
|---|---|---|
| `GEMINI_API_KEY` | empty | Secret. Server-side only. Without it, mock mode is used. |
| `AI_PROVIDER` | `auto` | `auto`, `gemini`, or `mock`. Unknown or keyless `gemini` falls back to mock. |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173` | Comma-separated allowed web origins. |
| `RATE_LIMIT` | `30/minute` | AI POST routes. Format `<number>/<second|minute|hour|day>`. |
| `RATE_LIMIT_READ` | `60/minute` | Source search GET. Same format. |
| `MAX_PROMPT_LENGTH` | `2000` | Currently only used for the lesson topic length check; model topic max is 200 anyway. |
| `MAX_RESPONSE_TOKENS` | `4096` | Defined but currently unused; Gemini hardcodes 4096. |
| `GEMINI_TIMEOUT` | `30.0` | Seconds; bounds the Gemini call. |

`backend/.env.example` currently documents `AI_PROVIDER`, `GEMINI_API_KEY`,
`CORS_ORIGINS`, `RATE_LIMIT`, `MAX_PROMPT_LENGTH`, and `MAX_RESPONSE_TOKENS`.
It **omits** `RATE_LIMIT_READ` and `GEMINI_TIMEOUT`; add them if you update the
template.

Invalid `RATE_LIMIT`/`RATE_LIMIT_READ` formats fail at startup with a clear
Pydantic validation error.

### Web (`frontend/.env.local` or shell environment)

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Build-time inlined. Public. |

### Mobile (`mobile/.env.local` or shell environment)

| Variable | Default | Notes |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:8000` | Inlined into the app bundle. Public. Use your PC's LAN IP for a physical phone. |

`localhost` on a phone means the phone itself. For a physical device, the
backend must also listen on the LAN (see the mobile run instructions below).

---

## 11. Setup and run

### Prerequisites

- Backend: Python **3.14.x** (validated on **3.14.4**), `pip`, and `venv`.
  On Kubuntu/Debian, install the matching `python3.14-venv` package if
  `python3.14 -m venv` reports that `ensurepip` is unavailable.
- No Rust, C compiler, or `maturin` is needed on supported Linux/Windows x86_64
  setups; the dependency set installs from binary wheels. Uvicorn's `uvloop`
  extra is skipped on Windows by its platform marker.
- Web: Node.js 22+ and npm.
- Mobile: Node.js + npm, Expo tooling (installed via `npm install`), and
  Expo Go or an Android emulator/device. Use Node.js 24+ for the native
  TypeScript test command.
- A Gemini API key is optional; without one the backend uses mock AI, but the
  backend is still required.

All backend commands below run **from `backend/`**. Verify the interpreter with
`python --version` after activation; it must report 3.14.x.

### Backend — Linux/macOS

```bash
cd backend
python3.14 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip check
cp .env.example .env          # optional; edit only if you need real AI
python -m uvicorn app.main:app --reload --port 8000
```

If `python3.14` is not on `PATH`, substitute the interpreter that reports
3.14.4. The virtual environment uses `venv/bin/` for `python`, `pip`, and
`uvicorn`.

### Backend — Windows (PowerShell)

```powershell
cd backend
py -3.14 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip check
Copy-Item .env.example .env   # optional; edit only if you need real AI
python -m uvicorn app.main:app --reload --port 8000
```

The virtual environment uses `venv\Scripts\` for `python.exe`, `pip.exe`, and
`uvicorn.exe`. If PowerShell blocks activation, use
`.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000`
directly, or run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
for the current shell only.

### Backend — common operations

From `backend/` with the venv active:

```bash
python -m pytest tests -q     # offline test suite
python -m pip check           # dependency consistency
deactivate                    # leave the venv
```

To recreate the environment, deactivate it, remove `venv` (`rm -rf venv` on
Linux/macOS; `Remove-Item -Recurse -Force venv` in PowerShell), then repeat the
setup commands. Do not reuse an environment created with another Python
version. The health endpoint is <http://localhost:8000/api/health>; docs are at
<http://localhost:8000/docs>.

### Web — Linux/macOS and Windows

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Production build and preview:

```bash
npm run build      # tsc -b && vite build -> frontend/dist/
npm run preview    # http://localhost:4173
```

The backend must be running for discovery, lesson generation, quizzes, tutor,
and source search. Saved/offline lesson reading uses IndexedDB and the cached
app shell.

### Mobile — Linux/macOS and Windows

Start the backend first (see above). Then:

```bash
cd mobile
npm install
npm run start      # Expo dev server; scan the QR code with Expo Go
# or:
npm run android
npm run ios
npm run web
```

### Mobile on a physical phone

1. Put the PC's LAN IP in `mobile/.env.local` (gitignored):

   ```text
   EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:8000
   ```

2. Start the backend bound to all interfaces so the phone can reach it. This
   is required; the default bind is loopback only:

   ```bash
   cd backend
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

3. Ensure the phone and PC are on the same network and the PC firewall allows
   port 8000.

Android emulators often reach the host at `10.0.2.2` rather than `localhost`;
that mapping was not verified in this repo. Local cleartext `http://` is for
development only. A production mobile build needs an HTTPS backend.

### Ports and origins

- Backend default: `8000`.
- Web dev: `5173`; web preview: `4173`.
- If you change a web origin, add it to `CORS_ORIGINS`.
- Native mobile requests are not subject to browser CORS, but the backend still
  needs to be reachable on the network.

---

## 12. Build, lint, test, and validation

Always run the checks relevant to the area you changed. Do not claim a task is
done without recorded evidence.

### Backend (from `backend/`, with the venv active)

Linux/macOS:

```bash
python -m pytest tests -q
```

Windows:

```powershell
.\venv\Scripts\python.exe -m pytest tests -q
```

The suite is designed to be fully offline: `backend/tests/conftest.py` routes
Wikipedia calls through `httpx.MockTransport` with recorded fixtures in
`backend/tests/fixtures/`. It also resets the shared rate limiter between
tests. Do not make tests depend on live Wikipedia or paid AI calls.

Current backend test inventory: **12 test modules, 83 test functions, 85
collected cases** (the extra two come from a parametrized config test). Last
recorded result: **85 passed, offline, on Python 3.14.4** (2026-10-31) in a
fresh isolated venv installed from `backend/requirements.txt`. `pip check`
reported no broken requirements. The suite emitted 62 Python 3.14 deprecation
warnings (see §4.1) but no failures.

A dependency smoke check from `backend/` with the venv active:

```bash
python -m pip check
python -c "import fastapi, pydantic, pydantic_settings, httpx, google.genai, slowapi, uvicorn; print('imports ok')"
```

### Web (from `frontend/`)

```bash
npm run lint       # oxlint
npm run build      # tsc -b && vite build; must pass before handoff
```

There is no frontend test framework and no test script. Last recorded result:
lint clean and build green with `399.68 kB` JS / `126.65 kB` gzip
(2026-10-13). Bundle size has not been re-measured since the mobile commit; do
not quote it as current without measuring.

### Mobile (from `mobile/`)

```bash
npm run lint       # expo lint / eslint
npm run typecheck  # tsc --noEmit
npm test           # node --test on pure helpers + review scheduler
npx expo export --platform android   # production bundle check
```

There are no recorded mobile check results in the consolidated docs. Run all
four before claiming mobile work is done. The export command may require
network access and may take a while on a low-memory machine.

### Documentation-only changes

If you change only this file, at minimum:

- Re-check every command against `package.json`/`requirements.txt`.
- Re-check every path exists.
- Re-check route names and env var names against source.
- Run `git diff` and `git status`.
- Do not claim runtime behavior was verified unless it actually was.

---

## 13. Test coverage and known gaps

### Covered

Backend tests cover:

- Health endpoint and provider resolution.
- Discover/feed, lessons/generate, quiz, evaluate, tutor, sources search.
- Mock provider paths.
- Gemini provider behavior with a fake client: thread offload, timeout bound,
  invalid JSON/empty response, key requirement (no real API call).
- Wikipedia source manager: summary, opensearch, extracts, redirects, missing
  pages, malformed payloads, timeouts/HTTP errors, dedupe.
- Citation structural validation.
- Config validation/fallbacks.
- Rate limiting and health exemption.
- Error sanitization (no exception class names/messages leaked).

Web:

- No automated tests. Manual browser verification of the core loop was
  recorded on 2026-10-11 against a production build + mock backend.

Mobile:

- Pure-function tests only: helpers and review scheduler. No component,
  navigation, storage-integration, or device tests.

### Known gaps / unverified claims

- Real Gemini API behavior (no key; no paid calls without approval).
- Windows runtime: the Python 3.14 install was executed on Linux x86_64 only.
  Windows x86_64 compatibility is **inferred** from cp314/abi3 wheel
  availability for every required distribution and Uvicorn's `uvloop` platform
  marker; it was not executed on a Windows machine.
- Python 3.14 deprecation/SyntaxWarnings from the unchanged FastAPI, Starlette,
  slowapi, pytest-asyncio, and anyio versions. They do not fail the suite.
- Transitive dependencies are resolved by pip and are not fully locked; the
  direct pins are in `backend/requirements.txt`.
- PWA runtime: service-worker registration, installability, offline shell, and
  offline reading on a real device/visible browser.
- Mobile runtime on an emulator or physical device; production Android export.
- Physical-phone connectivity, LAN binding, and cleartext HTTP behavior.
- Frontend bundle size after the mobile commit.
- Accessibility, dark-mode visual QA, and real-Android performance.
- No CI pipeline; checks are manual.
- No frontend test framework (adding one requires approval/new dependencies).

---

## 14. Known bugs, technical debt, and risky areas

### Functional bugs / gaps

- **Quiz answers are not persisted on web.** `QuizPage.tsx` writes
  `answers: []` to `quizAttempts`; score/questions/completedAt are stored.
- **Mock lesson is not topic-diverse.** It is the cocktail-party fixture
  retitled for other topics, with fixed quiz questions and possibly
  cocktail-party references merged with fetched sources.
- **Mobile has no Settings/preferences or feed personalization.** It requests a
  fixed feed (count 10) and generates lessons with a fixed 5-minute duration.
- **Mobile does not implement related-topic chips** or feed history/exclusions.
- **Web Settings error text hardcodes `http://localhost:8000`**, even when
  `VITE_API_URL` points elsewhere.
- **`MAX_RESPONSE_TOKENS` is unused**; Gemini hardcodes 4096.
- **`MAX_PROMPT_LENGTH` is only used for the lesson topic check**, not globally
  for all prompts.
- **`backend/.env.example` is missing `RATE_LIMIT_READ` and `GEMINI_TIMEOUT`.**
- **Primary Wikipedia extracts are not truncated** before being placed in the
  lesson-generation prompt; related extracts are capped at 1,000 chars. Long
  primary extracts can increase prompt size/cost (unverified impact).
- **Gemini client is constructed per request** (`get_ai_provider()`), which is
  inefficient.
- **Body-size guard is header-only** and does not catch chunked request bodies.
- **Rate limiter is single-process/in-memory**, resets on restart, and is not
  shared across workers.
- **No API authentication**; rate limiting is the only cost/abuse control.
- **Web `preferences.theme` is unused**; dark mode is CSS
  `prefers-color-scheme` only.
- **Mobile uses an unstable Expo API** (`expo-router/unstable-native-tabs`);
  review upgrade notes before bumping Expo.

### Maintenance gaps

- No frontend automated tests.
- No CI.
- No mobile component/integration tests.
- No real-device verification for PWA or mobile.
- No automated accessibility checks.
- No data export/backup/migration story for IndexedDB or AsyncStorage.
- No versioned storage migration beyond Dexie schema version 1 / fixed
  AsyncStorage keys.

### Do not “fix” by assumption

- Do not add PostgreSQL, auth, accounts, or server-side user storage without
  explicit user approval.
- Do not add heavy frontend dependencies or replace the plain-CSS/markdown
  approach without approval.
- Do not change AsyncStorage keys or Dexie schema without a migration plan.
- Do not change the provider interface casually; both providers and tests
  depend on its shape.
- Do not change prompt templates without considering output quality; only shape
  is tested.

---

## 15. Architectural decisions and open questions

### Decided

- **Local-first, guest-first, no accounts, no server user database.** User data
  stays on the device.
- **Server-side AI credentials only.** The clients never see AI keys.
- **Provider abstraction** so Gemini can be swapped for mock/other providers
  without changing routers.
- **Mock provider must always work without a key**, for development and tests
  that do not require a paid AI key. It does not remove the backend or
  Wikipedia dependency (see §4.6).
- **Rate limiting stays enabled** on all AI-facing routes as cost control.
- **Wikipedia grounding is best-effort**, with graceful degradation.
- **Citations are structurally validated, not semantically fact-checked**; the
  UI labels unverified references honestly.
- **PWA service worker caches static assets only**, never API responses.
- **Mobile talks to the existing backend** with no backend changes and no AI
  credentials on the device.
- **Android-first mobile experience**, while the web app remains mobile-first.

### Blocked on the user

1. **Accounts/PostgreSQL vs. staying local-first.** The original spec mentioned
   PostgreSQL + auth; the implemented design is deliberately stateless and
   local-first. Do not change this without an explicit decision.
2. **Real Gemini key and paid-call approval.** Mock mode is used until the user
   approves and provides a key.
3. **New dependencies**, especially frontend test tooling (e.g. Vitest) or any
   heavy UI library.
4. **Production deployment details** (HTTPS, hosting, auth/proxy, CORS
   origins, secret management).

---

## 16. Conventions and rules for future agents

### Before changing code

1. Read this file and inspect the relevant source. Do not assume documented
   behavior is current.
2. Run `git status --porcelain` and `git log --oneline -5`.
3. Treat uncommitted changes as another agent's owned work. Do not stage,
   commit, revert, or “clean up” what you do not understand.
4. Check whether the task touches a high-risk file listed below.

### Backend conventions

- Keep the `AIProvider` abstract interface stable. Add new capabilities as new
  abstract methods + mock implementations + tests.
- Keep the `{"detail": ...}` error contract.
- Log real exceptions server-side with `logger.exception`; return generic
  client messages. Never leak class names, stack traces, or secrets.
- Preserve rate limiting on AI-facing routes. Keep `/api/health` exempt.
- Use Pydantic models in `backend/app/models/` for request/response shapes.
- Keep tests offline: use `httpx.MockTransport`/fixtures, never live
  Wikipedia or paid AI calls.
- Python style: 4-space indent, type hints, existing logging/settings style.

### Web conventions

- React 19 + TypeScript strict; `erasableSyntaxOnly` means **no constructor
  parameter properties**.
- No Tailwind. Use plain CSS in `src/index.css`/`src/App.css`; color helpers
  return semantic class names such as `chip-blue`, not utility strings.
- Keep the bundle light. Current extra deps: `dexie`, `dexie-react-hooks`,
  `react-router-dom`, `lucide-react`. Do not add heavy dependencies without
  approval.
- Never index booleans in Dexie. Use `.filter()` for boolean queries.
- Keep `frontend/src/types/index.ts` in sync with backend models.
- Keep the markdown renderer escape-first and limited; do not inject raw HTML.
- Do not cache `/api/*` in the service worker.

### Mobile conventions

- Expo Router file-based routes; keep `typedRoutes` compatibility.
- Keep `mobile/src/types/index.ts` in sync with the backend contract.
- Keep runtime response/shape validation on API and storage boundaries.
- Only open `http(s)` URLs from server data.
- Keep AsyncStorage keys stable or write a migration.
- Keep the mobile app backend-compatible; do not add AI credentials to the app.
- Prefer small, dependency-light changes; this is an Android-first app.
- Run lint, typecheck, tests, and (when possible) an Android export before
  claiming mobile work done.

### Dependencies

- Do not install, upgrade, or remove dependencies unless the user explicitly
  approves.
- Keep frontend/mobile type shapes aligned with backend changes.
- When changing a shared contract, update backend models, web types, mobile
  types, API clients, and tests together.

### Git and coordination

- One agent owns a task at a time; another may review after handoff.
- Coordinate through the user and the repository state (`git status`, diffs),
  not out-of-band assumptions.
- Never rewrite history or force-push.
- Commit only when safe and when the workflow/user allows it; leave the tree
  clean when finished.
- Do not recreate `PROJECT_STATUS.md`, `HANDOFF.md`, `TASKS.md`, or similar
  competing docs unless the user explicitly asks. Update this `AGENTS.md`
  instead, including the status snapshot and known gaps.

### Definition of done

A task is done only when:

- The relevant code is implemented and reviewed.
- Backend tests pass if backend changed.
- Web lint/build pass if web changed.
- Mobile lint/typecheck/tests pass if mobile changed (and an export check is
  done when feasible).
- Documentation/status in this file is updated if behavior, commands, env vars,
  routes, or known gaps changed.
- `git diff` has been reviewed and the tree is left in the intended state.
- Any unverified claim is explicitly labeled unverified.

---

## 17. Quick reference

### High-risk files

- `backend/app/services/ai_provider.py` — provider contract; both providers
  and tests depend on it.
- `backend/app/services/prompts.py` — prompt quality; changes can alter AI
  output with no quality test.
- `backend/app/services/gemini.py` — real AI path; timeout/threading behavior.
- `backend/app/services/source_manager.py` — external APIs; graceful
  degradation.
- `backend/app/main.py` — CORS, body guard, rate-limit handler, global errors.
- `backend/app/config.py` — env defaults, provider fallback, limit validation.
- `backend/requirements.txt` — Python 3.14 pins; keep Pydantic on the validated
  2.12.x line so cp314 wheels are used.
- `frontend/src/db/database.ts` — Dexie schema; boolean-index hazard.
- `frontend/src/services/lessonStore.ts` — web lesson save/download/delete
  and feed history.
- `frontend/src/hooks/useLessons.ts` — web live queries and review-schedule
  advancement.
- `frontend/src/types/index.ts` — shared web contract.
- `mobile/src/types/index.ts` — shared mobile contract.
- `mobile/src/services/lessonStore.ts` — AsyncStorage keys/read-modify-write.
- `mobile/src/utils/review-scheduler.ts` — spaced-repetition rules.
- `frontend/public/sw.js` — offline/caching policy.
- `mobile/LICENSE` — legal notice; do not delete.

### Common commands

```bash
# Backend install/checks (from backend/, venv active)
python -m pip install -r requirements.txt
python -m pip check
python -m pytest tests -q

# Web checks (from frontend/)
npm run lint
npm run build

# Mobile checks (from mobile/)
npm run lint
npm run typecheck
npm test
npx expo export --platform android
```

### Runtime URLs

- Backend: `http://localhost:8000`
- Web dev: `http://localhost:5173`
- Web preview: `http://localhost:4173`
- Health: `http://localhost:8000/api/health`
- FastAPI docs: `http://localhost:8000/docs` (default, not disabled)

### Default provider behavior

- No `GEMINI_API_KEY` → mock provider.
- `AI_PROVIDER=auto` → Gemini only when a key exists.
- `AI_PROVIDER=gemini` without a key → mock with a startup warning.
- Unknown `AI_PROVIDER` → mock with a startup warning.
