"""Lesson-related data models."""

from pydantic import BaseModel, Field
from .common import Reference


class LessonSection(BaseModel):
    """A single section within a lesson."""
    heading: str
    content: str  # markdown formatted
    key_points: list[str] = []


class LessonResponse(BaseModel):
    """Complete generated lesson."""
    id: str
    title: str
    summary: str
    topic: str
    domain: str
    difficulty: str = "beginner"  # beginner, intermediate, advanced
    duration_minutes: int = 5
    sections: list[LessonSection]
    examples: list[str] = []
    takeaways: list[str] = []
    references: list[Reference] = []
    related_topics: list[str] = []
    generated_at: str  # ISO datetime


class LessonGenerateRequest(BaseModel):
    """Request to generate a lesson."""
    topic: str = Field(..., min_length=1, max_length=200)
    duration_minutes: int = Field(default=5, ge=2, le=15)
    depth: str = Field(default="beginner", pattern=r"^(beginner|intermediate|advanced)$")
    interests: list[str] = []


class FeedItem(BaseModel):
    """A discovery feed item."""
    id: str
    title: str
    hook: str  # Intriguing one-liner
    topic: str
    domain: str
    difficulty: str = "beginner"
    estimated_minutes: int = 5


class FeedRequest(BaseModel):
    """Request for discovery feed items."""
    interests: list[str] = []
    excluded_topics: list[str] = []
    history_ids: list[str] = []
    count: int = Field(default=10, ge=1, le=30)


class FeedResponse(BaseModel):
    """Response with feed items."""
    items: list[FeedItem]


class QuizQuestion(BaseModel):
    """A quiz question for a lesson."""
    id: str
    question: str
    options: list[str] = []  # For multiple choice
    correct_answer: str
    explanation: str = ""
    question_type: str = "multiple_choice"  # multiple_choice, open_ended


class QuizGenerateRequest(BaseModel):
    """Request to generate quiz questions."""
    lesson_content: str = Field(..., min_length=10, max_length=10000)
    topic: str = Field(..., min_length=1, max_length=200)
    difficulty: str = Field(default="beginner", pattern=r"^(beginner|intermediate|advanced)$")
    count: int = Field(default=3, ge=1, le=10)


class QuizResponse(BaseModel):
    """Response with quiz questions."""
    questions: list[QuizQuestion]


class AnswerEvaluation(BaseModel):
    """Evaluation of a user's answer."""
    is_correct: bool
    score: float = Field(ge=0, le=1)
    feedback: str
    correct_answer: str


class EvaluateRequest(BaseModel):
    """Request to evaluate an answer."""
    question: str = Field(..., min_length=1, max_length=1000)
    correct_answer: str = Field(..., min_length=1, max_length=1000)
    user_answer: str = Field(..., min_length=1, max_length=2000)
    question_type: str = Field(default="multiple_choice", pattern=r"^(multiple_choice|open_ended)$")


class TutorMessage(BaseModel):
    """A message in a tutor conversation."""
    role: str = Field(..., pattern=r"^(user|assistant)$")
    content: str


class TutorChatRequest(BaseModel):
    """Request for AI tutor chat."""
    lesson_id: str = ""
    lesson_context: str = Field(default="", max_length=5000)
    messages: list[TutorMessage] = []
    question: str = Field(..., min_length=1, max_length=1000)


class TutorResponse(BaseModel):
    """Response from AI tutor."""
    answer: str  # markdown
    follow_up_suggestions: list[str] = []
    references: list[Reference] = []
