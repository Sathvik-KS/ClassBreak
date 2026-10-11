"""ClassBreak FastAPI application."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
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
    if provider_name == "mock":
        logger.info("No API key configured — using mock provider. Set GEMINI_API_KEY in .env for real AI.")
    yield
    logger.info("ClassBreak shutting down")


# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Create app
app = FastAPI(
    title="ClassBreak API",
    description="AI-powered learning companion backend",
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
