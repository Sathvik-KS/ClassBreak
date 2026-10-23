// API client for the ClassBreak FastAPI backend.
// Ported from frontend/src/services/api.ts — adapted for React Native:
// - Base URL comes from the Expo public env var EXPO_PUBLIC_API_URL
//   (inlined at bundle time; falls back to localhost for simulators).
// - AbortController-based 30s timeout preserved.
// - HTTP errors keep the backend's {"detail": ...} contract.

import type {
  AnswerEvaluation,
  FeedItem,
  QuizQuestion,
  TutorMessage,
  TutorResponse,
} from '@/types';
import { isLessonShape } from '@/utils/helpers';

/** Base URL of the ClassBreak backend.
 *
 * Configure via EXPO_PUBLIC_API_URL (e.g. in mobile/.env.local):
 *   EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:8000
 * Use your PC's LAN IP when running on a physical phone — "localhost"
 * on the phone refers to the phone itself, not the PC.
 */
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// --- Response shape checks ------------------------------------------------
// The backend contract guarantees these shapes. Verifying them turns an
// unexpected response (wrong server, proxy error page with JSON body,
// future contract drift) into a clean on-screen error instead of a crash
// while a screen is rendering. Each predicate receives `unknown` on
// purpose: the JSON body is untrusted until checked.

function isFeedResponse(value: unknown): value is { items: FeedItem[] } {
  if (typeof value !== 'object' || value === null) return false;
  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items)) return false;
  // Every field a Discover card displays must be the right type —
  // getDomainColor/getDifficultyLabel would throw on a non-string.
  return (items as unknown[]).every((item) => {
    if (typeof item !== 'object' || item === null) return false;
    const feed = item as Record<string, unknown>;
    return (
      typeof feed.id === 'string' &&
      typeof feed.title === 'string' &&
      typeof feed.hook === 'string' &&
      typeof feed.topic === 'string' &&
      typeof feed.domain === 'string' &&
      typeof feed.difficulty === 'string' &&
      typeof feed.estimated_minutes === 'number'
    );
  });
}

function isQuizResponse(value: unknown): value is { questions: QuizQuestion[] } {
  if (typeof value !== 'object' || value === null) return false;
  const questions = (value as Record<string, unknown>).questions;
  if (!Array.isArray(questions)) return false;
  return (questions as unknown[]).every((question) => {
    if (typeof question !== 'object' || question === null) return false;
    const q = question as Record<string, unknown>;
    return (
      typeof q.question === 'string' &&
      typeof q.correct_answer === 'string' &&
      typeof q.explanation === 'string' &&
      typeof q.question_type === 'string' &&
      Array.isArray(q.options) &&
      (q.options as unknown[]).every((option) => typeof option === 'string')
    );
  });
}

function isEvaluationResponse(value: unknown): value is AnswerEvaluation {
  if (typeof value !== 'object' || value === null) return false;
  const evaluation = value as Record<string, unknown>;
  return (
    typeof evaluation.is_correct === 'boolean' &&
    // Number.isFinite rejects NaN, which would render as "NaN%".
    Number.isFinite(evaluation.score) &&
    typeof evaluation.feedback === 'string' &&
    typeof evaluation.correct_answer === 'string'
  );
}

function isTutorResponse(value: unknown): value is TutorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const tutor = value as Record<string, unknown>;
  if (typeof tutor.answer !== 'string') return false;
  if (!Array.isArray(tutor.follow_up_suggestions)) return false;
  if (!(tutor.follow_up_suggestions as unknown[]).every((s) => typeof s === 'string')) {
    return false;
  }
  if (!Array.isArray(tutor.references)) return false;
  // Reference titles are rendered and urls are opened with Linking.
  return (tutor.references as unknown[]).every((reference) => {
    if (typeof reference !== 'object' || reference === null) return false;
    const r = reference as Record<string, unknown>;
    return typeof r.title === 'string' && typeof r.url === 'string';
  });
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new ApiError(response.status, error.detail || `HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    // React Native's fetch throws a DOMException-like error named 'AbortError'.
    if ((e as Error)?.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out');
    }
    throw new ApiError(0, 'Network error — check that the backend is reachable');
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  health: () => apiFetch<{ status: string; ai_provider: string; version: string }>('/api/health'),

  discoverFeed: (data: {
    interests?: string[];
    excluded_topics?: string[];
    history_ids?: string[];
    count?: number;
  }) =>
    apiFetch<unknown>('/api/discover/feed', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((res) => {
      if (!isFeedResponse(res)) throw new ApiError(502, 'Server sent an unexpected response');
      return res;
    }),

  generateLesson: (data: {
    topic: string;
    duration_minutes?: number;
    depth?: string;
    interests?: string[];
  }) =>
    apiFetch<unknown>('/api/lessons/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((res) => {
      if (!isLessonShape(res)) throw new ApiError(502, 'Server sent an unexpected lesson');
      return res;
    }),

  generateQuiz: (data: {
    lesson_content: string;
    topic: string;
    difficulty?: string;
    count?: number;
  }) =>
    apiFetch<unknown>('/api/lessons/quiz', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((res) => {
      if (!isQuizResponse(res)) throw new ApiError(502, 'Server sent an unexpected response');
      return res;
    }),

  evaluateAnswer: (data: {
    question: string;
    correct_answer: string;
    user_answer: string;
    question_type?: string;
  }) =>
    apiFetch<unknown>('/api/lessons/evaluate', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((res) => {
      if (!isEvaluationResponse(res)) throw new ApiError(502, 'Server sent an unexpected response');
      return res;
    }),

  tutorChat: (data: {
    lesson_id?: string;
    lesson_context?: string;
    messages?: TutorMessage[];
    question: string;
  }) =>
    apiFetch<unknown>('/api/tutor/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((res) => {
      if (!isTutorResponse(res)) throw new ApiError(502, 'Server sent an unexpected response');
      return res;
    }),
};

export { API_BASE };
