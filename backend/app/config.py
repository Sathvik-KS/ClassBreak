"""Application configuration from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def effective_ai_provider(self) -> str:
        if self.ai_provider == "auto":
            return "gemini" if self.gemini_api_key else "mock"
        return self.ai_provider


settings = Settings()
