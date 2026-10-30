# ClassBreak

ClassBreak is a mobile-first learning companion for short breaks. It helps you
discover an interesting topic, read an AI-assisted lesson with Wikipedia source
grounding, ask follow-up questions, take a quiz, and save lessons for later
review.

## Components

- **Web (`frontend/`)** — mobile-first React client with saved lessons, quizzes,
  tutor chat, and spaced review. User data lives in IndexedDB.
- **Mobile (`mobile/`)** — Android-first Expo app with the same core learning
  loop. Saved lessons and review schedules live on the device in AsyncStorage.
- **Backend (`backend/`)** — stateless FastAPI service that proxies AI requests
  and fetches Wikipedia sources. It stores no user data and requires no account.

## Technology

- **Web:** React 19, TypeScript, Vite, Dexie, React Router, plain CSS.
- **Mobile:** Expo SDK 57, React Native, Expo Router, TypeScript, AsyncStorage.
- **Backend:** Python 3.13, FastAPI, Pydantic, httpx, Google Gen AI SDK, slowapi.
- **AI:** Google Gemini when a server-side key is configured, otherwise a
  built-in mock provider. Mock mode removes the AI-key requirement only; it
  still needs the backend and still attempts Wikipedia source lookups. Reading
  saved lessons is the offline capability.

## Prerequisites

- Python 3.13+ and pip for the backend.
- Node.js 22+ and npm for web development.
- Node.js 24+ for the current mobile test command, which relies on native
  TypeScript execution; npm for the Expo mobile app.
- Expo Go or an Android emulator/device for the mobile app.
- A Gemini API key is optional; the app runs in mock mode without one, but
  mock mode still requires the backend.

## Documentation

See [AGENTS.md](AGENTS.md) for the authoritative architecture, setup,
development commands, testing, configuration, environment variables, and
contribution instructions.
