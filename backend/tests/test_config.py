"""Tests for configuration behavior, especially mock-mode fallbacks."""

import pytest
from pydantic import ValidationError

from app.config import Settings


def _settings(**kwargs) -> Settings:
    """Settings ignoring any .env file so tests are deterministic."""
    return Settings(_env_file=None, **kwargs)


def test_auto_without_key_uses_mock():
    assert _settings(ai_provider="auto", gemini_api_key="").effective_ai_provider == "mock"


def test_auto_with_key_uses_gemini():
    assert (
        _settings(ai_provider="auto", gemini_api_key="fake-key").effective_ai_provider
        == "gemini"
    )


def test_explicit_gemini_without_key_falls_back_to_mock():
    """Never construct a keyless Gemini client — every request would fail."""
    assert _settings(ai_provider="gemini", gemini_api_key="").effective_ai_provider == "mock"


def test_explicit_gemini_with_key_uses_gemini():
    assert (
        _settings(ai_provider="gemini", gemini_api_key="fake-key").effective_ai_provider
        == "gemini"
    )


def test_unknown_provider_falls_back_to_mock():
    assert _settings(ai_provider="bogus", gemini_api_key="").effective_ai_provider == "mock"


def test_explicit_mock_stays_mock_even_with_key():
    assert (
        _settings(ai_provider="mock", gemini_api_key="fake-key").effective_ai_provider
        == "mock"
    )


def test_invalid_rate_limit_format_is_rejected_at_startup():
    """A bad RATE_LIMIT value fails fast with a clear config error,
    rather than silently disabling limiting or crashing at import time
    deep inside slowapi."""
    with pytest.raises(ValidationError):
        _settings(rate_limit="not-a-limit")


@pytest.mark.parametrize("value", ["30/minute", "5/second", "100/hour"])
def test_valid_rate_limit_formats_accepted(value):
    assert _settings(rate_limit=value).rate_limit == value
