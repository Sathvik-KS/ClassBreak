// TypeScript interfaces for the ClassBreak backend API.
// Ported from frontend/src/types/index.ts — subset required by the
// Discover -> Lesson flow. Field names mirror the FastPydantic models in
// backend/app/models/lesson.py exactly; keep both in sync.

/** A cited source for a lesson (backend app/models/common.py Reference). */
export interface Reference {
  title: string;
  url: string;
  /** "wikipedia" = matched a source the backend actually fetched;
   *  "provided" = structurally valid but unverified (model-supplied). */
  source_type: string;
  extract?: string;
}

export interface LessonSection {
  heading: string;
  /** Markdown-formatted text. */
  content: string;
  key_points: string[];
}

/** Full lesson returned by POST /api/lessons/generate (LessonResponse). */
export interface Lesson {
  id: string;
  title: string;
  summary: string;
  topic: string;
  domain: string;
  difficulty: string;
  duration_minutes: number;
  sections: LessonSection[];
  examples: string[];
  takeaways: string[];
  references: Reference[];
  related_topics: string[];
  generated_at: string;
}

/** One item in the discovery feed (FeedItem). */
export interface FeedItem {
  id: string;
  title: string;
  /** Intriguing one-liner. */
  hook: string;
  topic: string;
  domain: string;
  difficulty: string;
  estimated_minutes: number;
}

/** One question from POST /api/lessons/quiz (QuizQuestion). */
export interface QuizQuestion {
  id: string;
  question: string;
  /** Multiple-choice options; empty for open-ended questions. */
  options: string[];
  correct_answer: string;
  explanation: string;
  question_type: 'multiple_choice' | 'open_ended';
}

/** Result of POST /api/lessons/evaluate (AnswerEvaluation). */
export interface AnswerEvaluation {
  is_correct: boolean;
  /** 0.0 – 1.0 */
  score: number;
  feedback: string;
  correct_answer: string;
}

/** A lesson the user chose to keep, stored on-device (AsyncStorage).
 *  Simplification vs the web app: no `isDownloaded` flag — mobile has no
 *  separate offline-download concept yet. */
export interface SavedLesson extends Lesson {
  savedAt: string;
}

/** Spaced-review schedule for one saved lesson (same fields as web). */
export interface ReviewItem {
  id: string;
  lessonId: string;
  /** ISO date of the next due review. */
  nextReviewAt: string;
  /** Days until the next review after a correct answer. */
  interval: number;
  easeFactor: number;
  reviewCount: number;
}

/** One chat turn sent to POST /api/tutor/chat (TutorMessage). */
export interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Result of POST /api/tutor/chat (TutorResponse). */
export interface TutorResponse {
  /** Markdown answer. */
  answer: string;
  follow_up_suggestions: string[];
  references: Reference[];
}
