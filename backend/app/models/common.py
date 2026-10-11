"""Shared data models used across the application."""

from pydantic import BaseModel, Field


class Reference(BaseModel):
    """A source reference for lesson content."""
    title: str
    url: str
    source_type: str = "wikipedia"  # "wikipedia", "provided", etc.
    extract: str = ""


class ErrorResponse(BaseModel):
    """Standard error response."""
    detail: str
