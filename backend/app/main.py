"""ClassBreak FastAPI application."""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.rate_limit import limiter
from app.routers import discover, lessons, tutor, sources

# Configure logging — never log secrets
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    provider_name = settings.effective_ai_provider
    logger.info(f"ClassBreak starting with AI provider: {provider_name}")
    if settings.ai_provider not in ("auto", "gemini", "mock"):
        logger.warning(
            f"Unrecognized AI_PROVIDER={settings.ai_provider!r} — falling back to mock."
        )
    elif settings.ai_provider == "gemini" and provider_name == "mock":
        logger.warning(
            "AI_PROVIDER=gemini but GEMINI_API_KEY is not set — using mock provider."
        )
    if provider_name == "mock":
        logger.info("Using mock provider. Set GEMINI_API_KEY in .env for real AI.")
    yield
    logger.info("ClassBreak shutting down")


# Create app
app = FastAPI(
    title="ClassBreak API",
    description="AI-powered learning companion backend",
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiting (see app/rate_limit.py for scope/limitations)
app.state.limiter = limiter


def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """429 response using the app's {"detail": ...} error contract.

    slowapi's default handler returns {"error": ...}, which the frontend's
    API client would surface as a generic "HTTP 429". Retry-After is computed
    from the limiter's window stats so clients know when to retry.
    """
    response = JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}"},
    )
    try:
        limit_item, keys = request.state.view_rate_limit
        reset_at = app.state.limiter.limiter.get_window_stats(limit_item, *keys)[0]
        response.headers["Retry-After"] = str(max(1, int(reset_at - time.time()) + 1))
    except Exception:  # noqa: BLE001 — header is best-effort; never fail the 429
        logger.debug("Could not compute Retry-After", exc_info=True)
    return response


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

# Basic request-size guard (JSON bodies here are small: the largest accepted
# field is lesson_content at 10k chars). Header-only check: no body buffering.
MAX_BODY_BYTES = 100_000


@app.middleware("http")
async def body_size_guard(request: Request, call_next):
    content_length = request.headers.get("content-length", "")
    if content_length.isdigit() and int(content_length) > MAX_BODY_BYTES:
        return JSONResponse(
            status_code=413, content={"detail": "Request body too large"}
        )
    return await call_next(request)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# Include routers
app.include_router(discover.router)
app.include_router(lessons.router)
app.include_router(tutor.router)
app.include_router(sources.router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "ai_provider": settings.effective_ai_provider,
        "version": "0.1.0",
    }


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions without exposing internal details."""
    logger.error(f"Unhandled error on {request.url.path}: {type(exc).__name__}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )
