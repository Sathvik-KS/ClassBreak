// Lesson persistence and feed-history functions (used by hooks and pages).
// All data stays on-device in IndexedDB — guest-first, no server copy.

import { db } from '../db/database';
import { generateId } from '../utils/helpers';
import type { Lesson, SavedLesson, FeedItem } from '../types';

/** Save a generated lesson if not already saved; also schedules its first review. */
export async function saveLessonIfMissing(lesson: Lesson): Promise<void> {
  const existing = await db.lessons.get(lesson.id);
  if (existing) return;

  const saved: SavedLesson = {
    ...lesson,
    savedAt: new Date().toISOString(),
    isDownloaded: false,
  };
  await db.lessons.put(saved);

  await db.reviewItems.put({
    id: generateId(),
    lessonId: lesson.id,
    nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day
    interval: 1,
    easeFactor: 2.5,
    reviewCount: 0,
  });
}

export async function getSavedLesson(lessonId: string): Promise<SavedLesson | undefined> {
  return db.lessons.get(lessonId);
}

export async function setLessonDownloaded(lessonId: string, downloaded: boolean): Promise<void> {
  await db.lessons.update(lessonId, { isDownloaded: downloaded });
}

export async function deleteLessonAndData(lessonId: string): Promise<void> {
  await db.lessons.delete(lessonId);
  await db.reviewItems.where('lessonId').equals(lessonId).delete();
  await db.quizAttempts.where('lessonId').equals(lessonId).delete();
}

/** Record feed items as seen so the next feed can avoid repeating them. */
export async function recordFeedShown(items: FeedItem[]): Promise<void> {
  const now = new Date().toISOString();
  await db.feedHistory.bulkPut(
    items.map(item => ({ id: generateId(), feedItemId: item.id, action: 'seen' as const, timestamp: now })),
  );
  // Keep history bounded
  const count = await db.feedHistory.count();
  if (count > 200) {
    const oldest = await db.feedHistory.orderBy('timestamp').limit(count - 200).primaryKeys();
    await db.feedHistory.bulkDelete(oldest);
  }
}

/** Most recently shown feed item ids (newest first, capped). */
export async function recentFeedHistoryIds(limit = 20): Promise<string[]> {
  const rows = await db.feedHistory.orderBy('timestamp').reverse().limit(limit).toArray();
  return rows.map(r => r.feedItemId);
}
