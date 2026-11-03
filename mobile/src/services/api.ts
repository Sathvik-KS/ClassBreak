// API client for the ClassBreak FastAPI backend.
// Ported from frontend/src/services/api.ts — adapted for React Native:
// - Base URL comes from the Expo public env var EXPO_PUBLIC_API_URL
//   (inlined at bundle time; validated at runtime, no native localhost default).
// - AbortController-based 30s timeout preserved.
// - HTTP errors keep the backend's {"detail": ...} contract.

import { Platform } from 'react-native';

import type {
  AnswerEvaluation,
  FeedItem,
  QuizQuestion,
  TutorMessage,
  TutorResponse,
} from '@/types';
import { isLessonShape } from '@/utils/helpers';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Base URL of the ClassBreak backend.
 *
 * Configure via EXPO_PUBLIC_API_URL in mobile/.env.local (see
 * mobile/.env.example) and restart the dev server:
 *   EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:8000
 *
 * There is deliberately no baked-in "localhost" default for native builds.
 * On an Android phone "localhost" means the phone itself, so a silent
 * fallback produces a confusing "network error" instead of a clear setup
 * message. Only the web build (which runs in a browser on the same machine
 * as the backend during development) defaults to localhost.
 */
const WEB_DEFAULT_API_URL = 'http://localhost:8000';

export const API_CONFIG_ERROR =
  'Backend URL is not configured. Create mobile/.env.local with ' +
  'EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:8000 (see mobile/.env.example), ' +
  'then restart Expo with: npx expo start --clear';

/** Trim whitespace and any trailing slashes from a configured base URL. */
function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/** Validate a configured base URL. Returns null when it is unusable. */
function parseBaseUrl(value: string): string | null {
  const normalized = normalizeBaseUrl(value);
  // Avoid the URL constructor: React Native's polyfill is incomplete. A
  // scheme plus a non-empty host is all the client needs.
  if (!/^https?:\/\/[^\s/?#]+/i.test(normalized)) return null;
  return normalized;
}

let cachedApiBase: string | null = null;

/**
 * Resolve the backend base URL once per app session.
 *
 * Throws ApiError (status 0) with an actionable message when the URL is
 * missing or malformed, so screens can show setup instructions instead of
 * a generic network failure.
 */
export function getApiBaseUrl(): string {
  if (cachedApiBase) return cachedApiBase;

  const configured = process.env.EXPO_PUBLIC_API_URL;
  const platform = Platform.OS;

  if (!configured || configured.trim() === '') {
    if (platform === 'web') {
      cachedApiBase = WEB_DEFAULT_API_URL;
      return cachedApiBase;
    }
    throw new ApiError(0, API_CONFIG_ERROR);
  }

  const parsed = parseBaseUrl(configured);
  if (!parsed) {
    throw new ApiError(
      0,
      `EXPO_PUBLIC_API_URL is not a valid http(s) URL: ${JSON.stringify(configured)}. ` +
        'Example: http://192.168.1.20:8000',
    );
  }

  if (platform !== 'web' && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(parsed)) {
    // Not fatal: `adb reverse tcp:8000 tcp:8000` makes this work. But it is
    // the most common physical-device mistake, so surface it in dev logs.
    if (__DEV__) {
      console.warn(
        '[ClassBreak] EXPO_PUBLIC_API_URL points at localhost, which is the ' +
          'device itself on a phone. Use your computer LAN IP (or adb reverse).',
      );
    }
  }

  cachedApiBase = parsed;
  return cachedApiBase;
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
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
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
