// Dexie IndexedDB database for ClassBreak

import Dexie, { type Table } from 'dexie';
import type { SavedLesson, QuizAttempt, ReviewItem, Preferences, FeedHistoryItem } from '../types';

export class ClassBreakDB extends Dexie {
  preferences!: Table<Preferences>;
  lessons!: Table<SavedLesson>;
  quizAttempts!: Table<QuizAttempt>;
  reviewItems!: Table<ReviewItem>;
  feedHistory!: Table<FeedHistoryItem>;

  constructor() {
    super('classbreak');
    // NOTE: only valid IndexedDB key types (string/number/date) may be indexed.
    // Boolean fields (isDownloaded, synced) must NOT be indexed — boolean
    // values are not valid keys, so such records are silently excluded from
    // the index and index queries can never match them. Query with .filter().
    this.version(1).stores({
      preferences: 'id',
      lessons: 'id, topic, domain, savedAt',
      quizAttempts: 'id, lessonId, completedAt',
      reviewItems: 'id, lessonId, nextReviewAt',
      feedHistory: 'id, feedItemId, timestamp',
    });
  }
}

export const db = new ClassBreakDB();

// Initialize default preferences if not set
export async function ensureDefaults() {
  const existing = await db.preferences.get('default');
  if (!existing) {
    await db.preferences.put({
      id: 'default',
      interests: [],
      excludedTopics: [],
      defaultDuration: 5,
      theme: 'light',
      updatedAt: new Date().toISOString(),
    });
  }
}
