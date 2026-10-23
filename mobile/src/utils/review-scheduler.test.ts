// Tests for the spaced-review scheduler (port of the web app's rules).
// Run with: npm test

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { firstReviewState, nextReviewState } from './review-scheduler.ts';

const baseItem = {
  id: 'review-l1',
  lessonId: 'l1',
  interval: 1,
  easeFactor: 2.5,
  reviewCount: 0,
};

const now = new Date('2026-01-01T00:00:00.000Z');

test('a freshly saved lesson is first reviewed after one day', () => {
  assert.deepEqual(firstReviewState('review-l1', 'l1', now), {
    id: 'review-l1',
    lessonId: 'l1',
    nextReviewAt: '2026-01-02T00:00:00.000Z',
    interval: 1,
    easeFactor: 2.5,
    reviewCount: 0,
  });
});

test('first correct review schedules the next for day 1', () => {
  const next = nextReviewState(baseItem, true, now);
  assert.equal(next.interval, 1);
  assert.equal(next.reviewCount, 1);
  assert.equal(next.easeFactor, 2.6);
  assert.equal(next.nextReviewAt, '2026-01-02T00:00:00.000Z');
});

test('second correct review schedules day 3', () => {
  const next = nextReviewState({ ...baseItem, reviewCount: 1, interval: 1 }, true, now);
  assert.equal(next.interval, 3);
  assert.equal(next.nextReviewAt, '2026-01-04T00:00:00.000Z');
});

test('later correct reviews grow the interval by the ease factor', () => {
  const next = nextReviewState(
    { ...baseItem, reviewCount: 3, interval: 6, easeFactor: 2.5 },
    true,
    now,
  );
  assert.equal(next.interval, 15); // round(6 * 2.5)
  assert.equal(next.nextReviewAt, '2026-01-16T00:00:00.000Z');
});

test('a wrong answer resets to day 1 and lowers the ease factor', () => {
  const next = nextReviewState(
    { ...baseItem, reviewCount: 5, interval: 12, easeFactor: 2.5 },
    false,
    now,
  );
  assert.equal(next.interval, 1);
  assert.equal(next.easeFactor, 2.3);
  assert.equal(next.reviewCount, 6);
  assert.equal(next.nextReviewAt, '2026-01-02T00:00:00.000Z');
});

test('the ease factor never drops below 1.3', () => {
  const next = nextReviewState({ ...baseItem, easeFactor: 1.35 }, false, now);
  assert.equal(next.easeFactor, 1.3);
});
