# ClassBreak

A mobile-first, curiosity-driven learning companion designed for short breaks throughout the day.

**Core promise**: Discover something interesting, understand it deeply enough to use it, and remember it beyond the current session.

## Features

- **Discovery Feed** — Personalized suggestions of intriguing concepts and questions
- **Topic Exploration** — Browse domains, search subjects, follow related concepts
- **AI Tutor** — Get explanations, follow-up answers, analogies, adjustable depth
- **Source-Grounded Lessons** — Readable lessons with examples, takeaways, and citations
- **Quiz & Review** — Comprehension questions with spaced review scheduling
- **Offline Support** — Download lessons for offline reading and review
- **Guest-First** — No account required; all data stored locally

## Quick Start

### Prerequisites

- Python 3.13+
- Node.js 22+
- A Gemini API key (optional — works with mock data without one)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # Edit to add your API key
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                  # Starts on http://localhost:5173
```

### Production Build

```bash
cd frontend
npm run build                # Output in frontend/dist/
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | No | Google Gemini API key. Without it, the app uses mock AI responses. |
| `AI_PROVIDER` | No | `auto` (default), `gemini`, or `mock` |
| `CORS_ORIGINS` | No | Comma-separated allowed origins. Default: `http://localhost:5173` |

## Architecture

```
ClassBreak/
├── backend/          # FastAPI (Python) — AI proxy, source manager, rate limiting
├── frontend/         # React + Vite PWA — mobile-first UI, IndexedDB, service worker
├── .gitignore
└── README.md
```

- **Frontend** handles all user data locally (IndexedDB via Dexie.js)
- **Backend** proxies AI requests (protects API keys) and fetches reference sources
- **No server-side user database** — stateless backend, privacy-first
- **PWA** — installable, works offline with downloaded content

## License

Private — not yet licensed for distribution.
