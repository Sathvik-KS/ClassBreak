# ClassBreak

ClassBreak is a mobile-first learning app for short breaks: discover a topic,
read an AI-assisted lesson grounded in Wikipedia sources, ask follow-ups, take a
quiz, and review saved lessons later.

This README is the execution guide. It covers the three parts of the repository:

| Directory | What it is | Runs on |
|---|---|---|
| `backend/` | FastAPI AI proxy + Wikipedia source lookup (stateless, no database) | Python 3.14 |
| `frontend/` | React + Vite web / PWA client | Node.js |
| `mobile/` | Expo SDK 58 Android-first app (Expo Router) | Node.js + Expo Go |

The backend is **required** for discovery, lesson generation, quizzes, tutor
chat, and source search. Without a `GEMINI_API_KEY` it runs a built-in mock AI
provider, so no paid key is needed to run the app end to end.

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | **3.14.x** (validated on 3.14.4) | `pip` + `venv`. No Rust/C compiler needed; dependencies install from wheels. |
| Node.js | **22.13+**, **24.3+**, **26.x**, or **≥27** | Expo SDK 58 engine range. Node 22.13/24.3+ works for the web app. Use **Node 24+** for `npm test` in `mobile/` (native TypeScript test runner). |
| npm | bundled with Node.js | `npm ci` for fresh clones (both lockfiles are committed), `npm install` only when you change dependencies |
| Android phone | **Expo Go with SDK 58** (current Play Store build) | Or an Android emulator. Physical device and computer must share a network. |
| Browser | any modern browser | For the web app |

Optional: a Google Gemini API key. It stays server-side only; never put it in
`VITE_*` or `EXPO_PUBLIC_*` variables (those are compiled into public bundles).

---

## 2. Clone the repository

```bash
git clone https://github.com/Sathvik-KS/ClassBreak.git
cd ClassBreak
```

You will need three terminals (one per app) later. Each section below is
independent.

---

## 3. Backend setup

All backend commands run **from `backend/`**. Verify the interpreter after
activation: `python --version` must report 3.14.x.

### Linux / macOS

```bash
cd backend
python3.14 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip check

cp .env.example .env          # optional: mock AI works without editing it
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

`--host 0.0.0.0` listens on every network interface, so a phone on the same
Wi-Fi can reach the backend. The Uvicorn default (`127.0.0.1`) accepts
connections from this computer only, which breaks physical-device testing. If
you want a localhost-only server, use `--host 127.0.0.1` instead — but then the
Android app must run on the emulator, over `adb reverse`, or on Expo web (see
[§5](#5-android-application-setup)). Restrict inbound TCP 8000 to your LAN (see
[Bind to the network for a physical phone](#bind-to-the-network-for-a-physical-phone)).

If `python3.14` is not on `PATH`, substitute the interpreter that reports
3.14.4. On Kubuntu/Debian install `python3.14-venv` if `venv` reports that
`ensurepip` is unavailable.

### Windows (PowerShell)

```powershell
cd backend
py -3.14 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip check

Copy-Item .env.example .env   # optional: mock AI works without editing it
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The host-binding note above applies here too: `--host 0.0.0.0` is required for a
physical phone; `127.0.0.1` is local-only.

If activation is blocked by execution policy, either run
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` for the current
shell, or call the executables directly:

```powershell
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Environment and database

There is **no database and no migration step**: the backend is stateless and
stores no user data. User data lives on the device (IndexedDB / AsyncStorage).

`.env` is optional. Copy `backend/.env.example` to `backend/.env` and edit only
if you want real AI or non-default limits. Full variable list in
[§7](#7-environment-variables).

### Bind to the network for a physical phone

A phone cannot reach `127.0.0.1` on your computer. When testing on a real
Android device, start the backend on all interfaces (this is what the setup
commands above already do):

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Then allow inbound TCP 8000 **from your own LAN only** — never expose the
unauthenticated API to the internet. UFW example; **replace `192.168.1.0/24`
with your actual subnet**, which may be `10.0.0.0/24`, `192.168.0.0/24`,
`172.16.0.0/24`, etc. Find yours with `ip -4 addr show scope global` (the
`/24` next to `inet`) or from your router's DHCP settings:

```bash
# Grant the whole local subnet access to port 8000
sudo ufw allow from 192.168.1.0/24 to any port 8000 proto tcp

# Check the result
sudo ufw status
```

Remove the rule again with the same text after `delete`:

```bash
sudo ufw delete allow from 192.168.1.0/24 to any port 8000 proto tcp
```

If you leave `--host` at its `127.0.0.1` default, no firewall rule is needed
because nothing outside the machine can connect. Native app requests are not
affected by CORS, but the backend must be reachable over the LAN.

### Verify the backend

With the server running, this checks it **from the same machine** (it works with
either host binding). To confirm a phone can reach it, use the LAN check in
[§9](#9-verification):

```bash
curl http://localhost:8000/api/health
```

Expected (mock mode):

```json
{"status":"ok","ai_provider":"mock","version":"0.1.0"}
```

Interactive API docs: <http://localhost:8000/docs>

---

## 4. Web application setup

From `frontend/`:

```bash
cd frontend
npm ci                        # installs exactly the committed package-lock.json
cp .env.example .env.local    # optional; defaults to http://localhost:8000
npm run dev
```

`frontend/package-lock.json` is committed, so a fresh clone should use `npm ci`.
It fails loudly if `package.json` and the lockfile ever disagree; run
`npm install` only when you intentionally change dependencies.

Open <http://localhost:5173>. The web client defaults to
`http://localhost:8000`; set `VITE_API_URL` in `frontend/.env.local` only if the
backend runs elsewhere. Restart `npm run dev` after changing it.

Production build check:

```bash
npm run build      # tsc -b && vite build -> frontend/dist/
npm run preview    # serves the build on http://localhost:4173
```

---

## 5. Android application setup

The mobile app targets **Expo SDK 58** and runs in the current **Expo Go** from
the Play Store (no EAS build or custom development client required).

From `mobile/`:

```bash
cd mobile
npm ci                        # installs exactly the committed package-lock.json
cp .env.example .env.local    # then set EXPO_PUBLIC_API_URL (it starts empty)
npx expo start
```

`mobile/package-lock.json` is committed, so a fresh clone should use `npm ci`.
It fails loudly if `package.json` and the lockfile ever disagree; run
`npm install` (or `npx expo install --fix`) only when you intentionally change
dependencies.

`EXPO_PUBLIC_API_URL` is **required** for native builds — the app deliberately
has no `localhost` default, because on a phone `localhost` is the phone itself.
If it is missing the app shows a configuration message instead of a vague
network error. Restart Expo with `--clear` after changing `.env.local`.

### Choose the right URL

`mobile/.env.example` ships with an **empty** `EXPO_PUBLIC_API_URL=` on purpose:
there is no default and no sample IP, so a placeholder can never be mistaken for
a working address. Fill in one of these:

| Where the app runs | `EXPO_PUBLIC_API_URL` |
|---|---|
| Physical Android phone (same Wi-Fi) | `http://<your-computer-LAN-IP>:8000` |
| Android emulator | `http://10.0.2.2:8000` |
| USB device with port forwarding | `http://localhost:8000` (after `adb reverse tcp:8000 tcp:8000`) |
| Expo web (`npx expo start --web`) | `http://localhost:8000` |

To get your computer's LAN IP, run one of:

```bash
hostname -I | awk '{print $1}'       # Linux (or: ip -4 addr show scope global)
ipconfig getifaddr en0               # macOS (Wi-Fi; use en1/en2 if needed)
ipconfig                             # Windows: "IPv4 Address" of the active adapter
```

Use a private-range address (`192.168.x.x`, `10.x.x.x`, `172.16`–`172.31.x.x`) —
the one your phone can reach over Wi-Fi. Then set the value in
`mobile/.env.local`, e.g. `EXPO_PUBLIC_API_URL=http://192.168.1.23:8000`, and
restart Expo with `--clear`.

### Start and connect

1. Backend running with `--host 0.0.0.0 --port 8000`.
2. `npx expo start` in `mobile/` (defaults to port 8081).
3. Scan the QR code with Expo Go on Android (same Wi-Fi as the computer).
4. Press `a` to open an emulator instead, if you have one running.

The Expo dev server and Metro bundle run on port **8081**. Press `w` in the
Expo CLI to run the mobile app in a browser (its origin
`http://localhost:8081` is already allowed by the backend CORS defaults).

### Verify the app is connected

- In the phone browser, open `http://<your-computer-LAN-IP>:8000/api/health`.
  If that fails, the app cannot connect either — fix networking first.
- In the app, the Discover tab should load feed cards. If it shows
  "Backend URL is not configured", `.env.local` is missing or Expo was not
  restarted with `--clear`. If it shows a network error, the URL/firewall is
  wrong (see [§8](#8-troubleshooting)).

---

## 6. Running everything together

Terminal 1 — backend (LAN-accessible):

```bash
cd ClassBreak/backend
source venv/bin/activate                       # Windows: .\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

`--host 0.0.0.0` is what makes the backend reachable from a phone; see
[Bind to the network for a physical phone](#bind-to-the-network-for-a-physical-phone).

Terminal 2 — web:

```bash
cd ClassBreak/frontend
npm run dev
```

Terminal 3 — mobile:

```bash
cd ClassBreak/mobile
npx expo start
```

Ports: backend `8000`, web dev `5173`, web preview `4173`, Expo/Metro `8081`.

---

## 7. Environment variables

Backend: `backend/.env` (copy from `backend/.env.example`).
Web: `frontend/.env.local` (copy from `frontend/.env.example`).
Mobile: `mobile/.env.local` (copy from `mobile/.env.example`).

| Variable | Purpose | Example | Used by | Required |
|---|---|---|---|---|
| `AI_PROVIDER` | `auto`, `gemini`, or `mock` | `auto` | backend | No (default `auto`) |
| `GEMINI_API_KEY` | Server-side Gemini key (secret) | *(empty)* | backend | No — mock mode without it |
| `CORS_ORIGINS` | Comma-separated allowed web origins | `http://localhost:5173,http://localhost:4173,http://localhost:8081` | backend | No |
| `RATE_LIMIT` | Limit for AI POST routes | `30/minute` | backend | No (default `30/minute`) |
| `RATE_LIMIT_READ` | Limit for source search | `60/minute` | backend | No (default `60/minute`) |
| `MAX_PROMPT_LENGTH` | Max lesson topic length | `2000` | backend | No |
| `MAX_RESPONSE_TOKENS` | Reserved; Gemini currently hardcodes 4096 | `4096` | backend | No (unused) |
| `GEMINI_TIMEOUT` | Gemini request timeout (seconds) | `30.0` | backend | No (default `30.0`) |
| `VITE_API_URL` | Backend base URL for the web client | `http://localhost:8000` | web | No (defaults to it) |
| `EXPO_PUBLIC_API_URL` | Backend base URL for the mobile app | `http://<your-LAN-IP>:8000` | mobile | **Yes** for native |

`VITE_*` and `EXPO_PUBLIC_*` values are compiled into client bundles and are
**public**. Only backend URLs belong there — never keys or tokens.

---

## 8. Troubleshooting

**Expo Go says the project is incompatible**
The phone's Expo Go is on a different SDK than `mobile/`. This repo targets SDK
58; update Expo Go from the Play Store, then run
`cd mobile && npx expo-doctor` and `npx expo start --clear`. Check the project
version with `npx expo config --type public` (`sdkVersion` should be 58).

**`npm ci` fails / tarball or network errors**
Both apps commit their lockfiles, so install with `npm ci`. After a failed
attempt, remove the partial tree and retry with a stable connection:
`rm -rf node_modules && npm ci` (Windows:
`Remove-Item -Recurse -Force node_modules; npm ci`). If npm reports
`TAR_BAD_ARCHIVE`, run `npm cache verify` (or `npm cache clean --force`) and
retry. Do not use `--force` or `--legacy-peer-deps`; conflicting versions should
be fixed with `npx expo install --fix` in `mobile/`. If `npm ci` reports that
`package.json` and `package-lock.json` are out of sync, the lockfile needs to be
regenerated deliberately with `npm install` — do not work around it.

**Metro cache or stale bundle issues**
`npx expo start --clear` in `mobile/`. If it persists, remove `.expo/` and
`node_modules/.cache/`, then restart. Reload the app in Expo Go afterwards.

**Expo Go cannot connect to the dev server**
Phone and computer must be on the same Wi-Fi, with VPNs/guest isolation off and
firewall allowing 8081. On Windows allow Node.js on private networks. As a
fallback use `npx expo start --tunnel` (Expo may ask to install a tunnel
dependency).

**App shows "Backend URL is not configured"**
`mobile/.env.local` is missing or still has the empty
`EXPO_PUBLIC_API_URL=` from `.env.example`. Set it (see
[§5](#choose-the-right-url)) and restart Expo with `npx expo start --clear`.

**App loads but cannot reach the backend (physical device)**
1. `curl http://<LAN-IP>:8000/api/health` from another machine.
2. Backend must be started with `--host 0.0.0.0`, not the default loopback.
3. `mobile/.env.local` must contain the **LAN IP**, not `localhost`.
4. Allow TCP 8000 in the firewall and avoid client-isolation Wi-Fi.
5. Restart Expo with `npx expo start --clear` (env vars are read at bundle time).

**Android emulator cannot reach the backend**
Use `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000` (the host machine as seen from the
emulator), or run `adb reverse tcp:8000 tcp:8000` and use `localhost`.

**Web shows a CORS error**
Add the exact origin (scheme, host, port) to `CORS_ORIGINS` in `backend/.env` and
restart the backend. Defaults already allow `5173`, `4173`, and `8081`.

**Port already in use**
Linux/macOS: `lsof -i :8000` (or `:5173`, `:8081`). Windows:
`netstat -ano | findstr :8000`. Stop the process, or start the backend on
another port and set `VITE_API_URL` / `EXPO_PUBLIC_API_URL` to match.

**Python environment problems**
Use Python 3.14 (`python --version`). If `venv` creation or installs fail,
delete the environment (`rm -rf venv` / `Remove-Item -Recurse -Force venv`),
reinstall `python3.14-venv` on Debian/Kubuntu, and repeat
[§3](#3-backend-setup). Never reuse a `venv` created with another Python
version.

**Web build fails**
Run `npm run build` from `frontend/` and read the TypeScript error (strict mode
is on). If it reports an error for code that looks correct, delete the stale
incremental cache and rebuild: `rm -f tsconfig*.tsbuildinfo *.tsbuildinfo`.
For a full reset, `rm -rf node_modules dist && npm ci && npm run build`.

---

## 9. Verification

### Backend — localhost-only check

Run from `backend/` with the venv active. This block verifies the API on the
machine running it and deliberately binds to loopback (`127.0.0.1`), so it does
**not** prove that a phone can reach the backend:

```bash
python -m pip check
python -m pytest tests -q                    # offline suite, no network or AI key needed
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000   # loopback only
# in a second terminal:
curl http://localhost:8000/api/health
```

### Backend — LAN / physical-device check

To verify what the Android app will actually do, bind to all interfaces and
request the health endpoint over the LAN from the phone's browser or another
computer (see [§3](#3-backend-setup) for the firewall rule):

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
# from the phone or another machine on the same Wi-Fi:
curl http://<your-computer-LAN-IP>:8000/api/health
```

Expected in both cases (mock mode):

```json
{"status":"ok","ai_provider":"mock","version":"0.1.0"}
```

Web (from `frontend/`):

```bash
npm run lint
npx tsc -b
npm run build
```

Mobile (from `mobile/`):

```bash
npm run typecheck
npm run lint
npm test                            # Node 24+
npx expo-doctor
npx expo export --platform android  # production Android bundle check
npx expo start                      # Metro + QR code for Expo Go
```

Physical-device behavior (QR scan, LAN connectivity, Expo Go runtime) can only
be confirmed on a real phone; the commands above verify dependencies, types,
bundling, and the dev server.

---

## More documentation

[`AGENTS.md`](AGENTS.md) is the canonical engineering reference: architecture,
API contract, data storage, configuration details, known gaps, and conventions.
