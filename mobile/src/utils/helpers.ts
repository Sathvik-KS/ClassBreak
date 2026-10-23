// Small shared helpers for the mobile app.

import type { Lesson } from '@/types';

/** Build the lesson-content string that /api/lessons/quiz expects as
 *  `lesson_content`. Structurally typed (no imports) so it works with any
 *  Lesson-shaped object and stays trivially testable. */
export function lessonToContext(lesson: {
  title: string;
  sections: { heading: string; content: string }[];
  takeaways: string[];
}): string {
  const sectionText = lesson.sections
    .map((s) => `## ${s.heading}\n${s.content}`)
    .join('\n\n');
  const takeawayText =
    lesson.takeaways.length > 0
      ? `\n\nKey Takeaways:\n${lesson.takeaways.map((t) => `- ${t}`).join('\n')}`
      : '';
  return `# ${lesson.title}\n\n${sectionText}${takeawayText}`;
}

/** Average of a score list (0 when empty). Used for the quiz result. */
export function averageScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const total = scores.reduce((sum, s) => sum + s, 0);
  return total / scores.length;
}

/** Minimum average score to count a quiz as passed (matches web app). */
export const PASS_SCORE = 0.6;

/** Short date like "Oct 23" for review due dates. */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'unknown date';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Only plain web links may be opened externally. API-provided URLs are
 *  data, not instructions: refuse other schemes (`javascript:`, `intent:`,
 *  `file:` …) so a misbehaving server can never trigger arbitrary device
 *  actions from a link press. */
export function isSafeWebUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

/** Runtime check that an unknown value has every field the lesson screens
 *  read. Used on two trust boundaries — the server response from
 *  POST /api/lessons/generate and lessons restored from device storage —
 *  so malformed data becomes a clean on-screen error instead of a crash
 *  in the middle of rendering. */
export function isLessonShape(value: unknown): value is Lesson {
  if (typeof value !== 'object' || value === null) return false;
  const lesson = value as Record<string, unknown>;

  const requiredStrings = [
    'id',
    'title',
    'summary',
    'topic',
    'domain',
    'difficulty',
    'generated_at',
  ];
  if (!requiredStrings.every((field) => typeof lesson[field] === 'string')) return false;
  if (typeof lesson.duration_minutes !== 'number') return false;

  // Sections are rendered line-by-line, so each field must be a string.
  if (!Array.isArray(lesson.sections)) return false;
  const sectionsOk = (lesson.sections as unknown[]).every((section) => {
    if (typeof section !== 'object' || section === null) return false;
    const s = section as Record<string, unknown>;
    return (
      typeof s.heading === 'string' &&
      typeof s.content === 'string' &&
      Array.isArray(s.key_points) &&
      (s.key_points as unknown[]).every((point) => typeof point === 'string')
    );
  });
  if (!sectionsOk) return false;

  // Bullet lists are rendered as Text children — objects would crash React.
  if (!Array.isArray(lesson.examples) || !Array.isArray(lesson.takeaways)) return false;
  if (!(lesson.examples as unknown[]).every((item) => typeof item === 'string')) return false;
  if (!(lesson.takeaways as unknown[]).every((item) => typeof item === 'string')) return false;

  if (!Array.isArray(lesson.references)) return false;
  const referencesOk = (lesson.references as unknown[]).every((reference) => {
    if (typeof reference !== 'object' || reference === null) return false;
    const r = reference as Record<string, unknown>;
    return (
      typeof r.title === 'string' &&
      typeof r.url === 'string' &&
      typeof r.source_type === 'string'
    );
  });
  if (!referencesOk) return false;

  return Array.isArray(lesson.related_topics);
}
