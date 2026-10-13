"""Application configuration from environment variables."""

import re

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_RATE_LIMIT_RE = re.compile(r"^\d+/(second|minute|hour|day)$")


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # AI Provider
    gemini_api_key: str = ""
    ai_provider: str = "auto"  # "gemini", "mock", "auto"

    # Server
    cors_origins: str = "http://localhost:5173,http://localhost:4173"

    # Rate limiting
    rate_limit: str = "30/minute"
    rate_limit_read: str = "60/minute"

    # Generation limits
    max_prompt_length: int = 2000
    max_response_tokens: int = 4096

    # Gemini request timeout (seconds) — enforced around the SDK call so an
    # unreachable provider can't hang a request indefinitely.
    gemini_timeout: float = 30.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @field_validator("rate_limit", "rate_limit_read")
    @classmethod
    def _validate_limit_format(cls, v: str) -> str:
        """Fail fast with a clear config error on a malformed limit string.

        slowapi would otherwise raise an opaque ValueError at import time.
        """
        if not _RATE_LIMIT_RE.match(v.strip()):
            raise ValueError(
                f"invalid limit {v!r}: expected '<number>/<second|minute|hour|day>', "
                "e.g. '30/minute'"
            )
        return v

    @property
    def effective_ai_provider(self) -> str:
        """Resolve the provider safely.

        - "auto": gemini when a key is set, otherwise mock.
        - "gemini" without a key: falls back to mock (never construct a
          keyless Gemini client — every request would fail).
        - Any unknown value: falls back to mock (safe default; mock always
          works without credentials).
        """
        if self.ai_provider == "auto":
            return "gemini" if self.gemini_api_key else "mock"
        if self.ai_provider == "gemini":
            return "gemini" if self.gemini_api_key else "mock"
        if self.ai_provider == "mock":
            return "mock"
        return "mock"  # unrecognized value → safe fallback


settings = Settings()
