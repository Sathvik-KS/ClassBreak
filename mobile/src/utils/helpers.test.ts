// Tests for the pure helper functions. Run with: npm test
// (Node 24 runs TypeScript directly — no test framework dependency needed.)

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PASS_SCORE,
  averageScore,
  formatDate,
  isLessonShape,
  isSafeWebUrl,
  lessonToContext,
} from './helpers.ts';

const sampleLesson = {
  title: 'How Bridges Stay Up',
  sections: [
    { heading: 'Forces', content: 'Bridges carry loads.' },
    { heading: 'Materials', content: 'Steel resists tension.' },
  ],
  takeaways: ['Load paths matter.', 'Materials differ.'],
};

test('lessonToContext includes title, sections and takeaways', () => {
  const text = lessonToContext(sampleLesson);
  assert.ok(text.includes('# How Bridges Stay Up'));
  assert.ok(text.includes('## Forces\nBridges carry loads.'));
  assert.ok(text.includes('## Materials\nSteel resists tension.'));
  assert.ok(text.includes('Key Takeaways:'));
  assert.ok(text.includes('- Load paths matter.'));
});

test('lessonToContext omits the takeaways block when there are none', () => {
  const text = lessonToContext({ title: 'T', sections: [], takeaways: [] });
  assert.ok(!text.includes('Key Takeaways'));
});

test('averageScore averages the list and returns 0 for an empty list', () => {
  assert.equal(averageScore([1, 0, 1]), 2 / 3);
  assert.equal(averageScore([0.5, 0.5]), 0.5);
  assert.equal(averageScore([]), 0);
});

test('pass score matches the web app (0.6)', () => {
  assert.equal(PASS_SCORE, 0.6);
});

test('formatDate flags unreadable dates and formats real ones', () => {
  assert.equal(formatDate('not-a-date'), 'unknown date');
  const formatted = formatDate('2026-10-23T00:00:00.000Z');
  assert.notEqual(formatted, 'unknown date');
  assert.ok(formatted.length > 0);
});

test('isSafeWebUrl accepts http(s) and refuses every other scheme', () => {
  assert.equal(isSafeWebUrl('https://example.org/page'), true);
  assert.equal(isSafeWebUrl('http://localhost:8000'), true);
  assert.equal(isSafeWebUrl('javascript:alert(1)'), false);
  assert.equal(isSafeWebUrl('intent://scan#Intent;scheme=zxing;end'), false);
  assert.equal(isSafeWebUrl('file:///etc/passwd'), false);
  assert.equal(isSafeWebUrl(''), false);
  assert.equal(isSafeWebUrl(123), false);
  assert.equal(isSafeWebUrl(null), false);
});

// A complete, valid lesson used by the shape checks below.
const validLesson = {
  id: 'lesson-1',
  title: 'How Bridges Stay Up',
  summary: 'Loads, forces and materials.',
  topic: 'bridges',
  domain: 'engineering',
  difficulty: 'beginner',
  duration_minutes: 5,
  sections: [{ heading: 'Forces', content: 'Bridges carry loads.', key_points: ['Load paths'] }],
  examples: ['A suspension bridge'],
  takeaways: ['Materials differ'],
  references: [{ title: 'Bridge', url: 'https://example.org', source_type: 'wikipedia' }],
  related_topics: ['arches'],
  generated_at: '2026-01-01T00:00:00.000Z',
};

test('isLessonShape accepts a well-formed lesson', () => {
  assert.equal(isLessonShape(validLesson), true);
  // Saved lessons add a field — that must still pass.
  assert.equal(isLessonShape({ ...validLesson, savedAt: '2026-01-02T00:00:00Z' }), true);
});

test('isLessonShape rejects missing or mistyped fields', () => {
  assert.equal(isLessonShape(null), false);
  assert.equal(isLessonShape('not a lesson'), false);
  assert.equal(isLessonShape({ ...validLesson, sections: undefined }), false);
  assert.equal(isLessonShape({ ...validLesson, title: 42 }), false);
  assert.equal(isLessonShape({ ...validLesson, duration_minutes: '5' }), false);
  // Non-string bullet items would crash React's Text component.
  assert.equal(isLessonShape({ ...validLesson, takeaways: [{ nested: true }] }), false);
  // Section content feeds the markdown renderer, which calls split().
  assert.equal(
    isLessonShape({ ...validLesson, sections: [{ heading: 'H', content: null, key_points: [] }] }),
    false,
  );
});
