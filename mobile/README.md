# ClassBreak Mobile (Expo)

Android-first mobile app for ClassBreak, built with Expo SDK 57, Expo Router,
React Native and TypeScript. It talks to the existing FastAPI backend in
`backend/` — no backend changes, no AI credentials on the device.

## Features

- **Discover** — feed of topic ideas from `POST /api/discover/feed`
- **Lesson** — generated lesson from `POST /api/lessons/generate`, with save,
  quiz and tutor actions
- **Quiz** — 5 questions from `POST /api/lessons/quiz`; multiple choice is
  checked locally, open-ended answers go through `POST /api/lessons/evaluate`
- **Tutor** — chat via `POST /api/tutor/chat` with the lesson as context
- **Saved** — lessons kept on-device in AsyncStorage (works offline)
- **Review** — spaced-repetition schedule (a small port of the web app's
  algorithm) with due / upcoming lists

## Run it

```bash
npm install          # once, or after dependency changes
npm run start        # Expo dev server → scan the QR code with Expo Go
```

Backend (separate terminal, from `backend/`):

```bash
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

The mock AI provider is used automatically when no API key is configured, so
no Gemini key is needed for development. To force the mock provider explicitly
(never call Gemini):

```powershell
# PowerShell, before starting uvicorn
$env:AI_PROVIDER='mock'
```

### Physical phone setup

On a phone, `localhost` is the phone itself. Put your PC's LAN IP in
`mobile/.env.local` (this file is git-ignored — never commit it):

```
EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:8000
```

### Security notes

- `EXPO_PUBLIC_*` values are **compiled into the app bundle** and readable by
  anyone who has the app. Only the backend URL belongs there — never an API
  key or token. AI credentials stay server-side in `backend/.env`.
- Plain `http://` is fine for local development. A production deployment must
  serve the backend over **HTTPS** and set `EXPO_PUBLIC_API_URL` to that
  `https://` URL.
- Saved lessons and review schedules live only in this device's AsyncStorage;
  nothing is synced to a server.

## Checks

```bash
npm run lint         # eslint (oxlint-free: expo lint)
npm run typecheck    # tsc --noEmit
npm test             # node --test: pure-function tests (helpers, review rules)
npx expo export --platform android   # production bundle check
```

## Layout

```
src/app/                 screens (Expo Router file-based navigation)
  (tabs)/                Discover, Saved, Review tabs
  lesson/[topic].tsx     generated lesson
  saved/[id].tsx         stored lesson (offline)
  quiz.tsx  tutor.tsx
src/components/          shared UI (lesson-content, markdown-text, tabs)
src/services/api.ts      backend HTTP client (30 s timeout, typed errors)
src/services/lessonStore.ts  AsyncStorage persistence (saved + reviews)
src/utils/               pure helpers + review scheduler (unit-tested)
```
