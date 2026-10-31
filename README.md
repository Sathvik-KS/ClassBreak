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
- **Backend:** Python 3.14 (validated on 3.14.4), FastAPI, Pydantic, httpx,
  Google Gen AI SDK, slowapi.
- **AI:** Google Gemini when a server-side key is configured, otherwise a
  built-in mock provider. Mock mode removes the AI-key requirement only; it
  still needs the backend and still attempts Wikipedia source lookups. Reading
  saved lessons is the offline capability.

## Prerequisites

- **Backend:** Python 3.14.x (validated on 3.14.4), `pip`, and `venv`.
  On Kubuntu/Debian, install the matching `python3.14-venv` package if
  `python3.14 -m venv` reports that `ensurepip` is unavailable.
- **No Rust, C compiler, or `maturin` is required** on supported Linux and
  Windows x86_64 setups: the pinned dependencies install from binary wheels.
- **Web:** Node.js 22+ and npm.
- **Mobile:** Node.js 24+ for the native-TypeScript test command, plus npm,
  Expo Go or an Android emulator/device.
- A Gemini API key is optional; the app runs in mock mode without one.

## Backend setup

The backend is required for discovery, lesson generation, quizzes, tutor chat,
and source search. All commands below run from the `backend/` directory unless
stated otherwise. The default mock provider makes no paid AI calls and needs no
key.

### Linux / Kubuntu

```bash
cd backend
python3.14 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip check
cp .env.example .env          # optional; mock mode works without editing it
python -m uvicorn app.main:app --reload --port 8000
```

If `python3.14` is not on `PATH`, use the interpreter that reports 3.14.4.
After activation, `python --version` should print `Python 3.14.4`.

### Windows / PowerShell

```powershell
cd backend
py -3.14 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip check
Copy-Item .env.example .env   # optional; mock mode works without editing it
python -m uvicorn app.main:app --reload --port 8000
```

If PowerShell blocks activation, use the venv executables directly:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Alternatively, allow activation for the current shell only with
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.

### `bin/` on Linux versus `Scripts/` on Windows

A virtual environment keeps its executables in `venv/bin/` on Linux/macOS and
in `venv\Scripts\` on Windows. Activation is `source venv/bin/activate` versus
`.\venv\Scripts\Activate.ps1`; the Python executable is `venv/bin/python` versus
`venv\Scripts\python.exe`. The backend commands above are otherwise identical.

### Environment variables

`.env.example` is the template. Copy it to `.env` (gitignored) and edit only if
needed; never commit `.env` or real keys.

- `AI_PROVIDER=auto` uses Gemini when `GEMINI_API_KEY` is set, otherwise mock.
- `GEMINI_API_KEY` stays server-side. Leave it empty for mock mode.
- `CORS_ORIGINS` lists allowed web origins.
- `RATE_LIMIT` controls AI request throttling.

`backend/app/config.py` also supports `RATE_LIMIT_READ` and `GEMINI_TIMEOUT`;
both have safe defaults and are optional. See [AGENTS.md](AGENTS.md) for the
complete configuration reference.

### Common operations

Run these from `backend/` with the virtual environment active:

```bash
python -m pytest tests -q     # offline backend test suite
python -m pip check           # verify installed dependency consistency
deactivate                    # leave the virtual environment
```

To recreate the environment from scratch, deactivate it, remove the `venv`
directory (`rm -rf venv` on Linux, `Remove-Item -Recurse -Force venv` in
PowerShell), then repeat the setup commands. Do not reuse an environment
created with a different Python version.

### Verify the backend

With the server running:

- Health check: <http://localhost:8000/api/health>
- Interactive API docs: <http://localhost:8000/docs>

The health response should show `"status":"ok"` and `"ai_provider":"mock"`
when no Gemini key is configured.

## Documentation

See [AGENTS.md](AGENTS.md) for the authoritative architecture, API contract,
setup, development commands, testing, configuration, environment variables, and
contribution instructions.
