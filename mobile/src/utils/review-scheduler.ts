// Spaced-review scheduling — a small pure port of the web app's algorithm
// (frontend/src/hooks/useLessons.ts updateReview). No I/O here so the rules
// are easy to read, test, and change.

import type { ReviewItem } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Compute the next review state after the user finished a quiz.
 *
 * Rules (same as the web app):
 * - Correct answer: first review -> 1 day, second -> 3 days, later ->
 *   interval * easeFactor. Ease factor grows by 0.1 (min 1.3).
 * - Wrong answer: back to 1 day, ease factor shrinks by 0.2 (min 1.3).
 *
 * Returns a complete ReviewItem ready to store. `now` is injectable so
 * tests don't have to touch the real clock. */
export function nextReviewState(
  current: Pick<ReviewItem, 'id' | 'lessonId' | 'interval' | 'easeFactor' | 'reviewCount'>,
  wasCorrect: boolean,
  now: Date = new Date(),
): ReviewItem {
  const reviewCount = current.reviewCount + 1;
  let interval: number;
  let easeFactor: number;

  if (wasCorrect) {
    if (reviewCount === 1) interval = 1;
    else if (reviewCount === 2) interval = 3;
    else interval = Math.round(current.interval * current.easeFactor);
    easeFactor = Math.max(1.3, current.easeFactor + 0.1);
  } else {
    interval = 1;
    easeFactor = Math.max(1.3, current.easeFactor - 0.2);
  }

  return {
    id: current.id,
    lessonId: current.lessonId,
    nextReviewAt: new Date(now.getTime() + interval * DAY_MS).toISOString(),
    interval,
    easeFactor,
    reviewCount,
  };
}

/** The first review for a freshly saved lesson is due in one day. */
export function firstReviewState(
  id: string,
  lessonId: string,
  now: Date = new Date(),
): ReviewItem {
  return {
    id,
    lessonId,
    nextReviewAt: new Date(now.getTime() + DAY_MS).toISOString(),
    interval: 1,
    easeFactor: 2.5,
    reviewCount: 0,
  };
}
