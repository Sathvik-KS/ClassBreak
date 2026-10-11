// API client for ClassBreak backend

import type { Lesson, FeedItem, TutorResponse, QuizQuestion, AnswerEvaluation } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
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
    return response.json();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out');
    }
    throw new ApiError(0, 'Network error — check your connection');
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  health: () => apiFetch<{ status: string; ai_provider: string }>('/api/health'),

  discoverFeed: (data: {
    interests?: string[];
    excluded_topics?: string[];
    history_ids?: string[];
    count?: number;
  }) => apiFetch<{ items: FeedItem[] }>('/api/discover/feed', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  generateLesson: (data: {
    topic: string;
    duration_minutes?: number;
    depth?: string;
    interests?: string[];
  }) => apiFetch<Lesson>('/api/lessons/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  tutorChat: (data: {
    lesson_id?: string;
    lesson_context?: string;
    messages?: { role: string; content: string }[];
    question: string;
  }) => apiFetch<TutorResponse>('/api/tutor/chat', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  generateQuiz: (data: {
    lesson_content: string;
    topic: string;
    difficulty?: string;
    count?: number;
  }) => apiFetch<{ questions: QuizQuestion[] }>('/api/lessons/quiz', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  evaluateAnswer: (data: {
    question: string;
    correct_answer: string;
    user_answer: string;
    question_type?: string;
  }) => apiFetch<AnswerEvaluation>('/api/lessons/evaluate', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  searchSources: (query: string) =>
    apiFetch<{ sources: any[]; extracts: string[] }>(`/api/sources/search?q=${encodeURIComponent(query)}`),
};

export { ApiError };
