// On-device persistence for saved lessons and their review schedules.
//
// AsyncStorage stores two JSON lists under fixed keys:
//   - saved lessons (SavedLesson = a generated lesson + when it was saved)
//   - review items (one spaced-repetition schedule per saved lesson)
//
// This is the mobile equivalent of the web app's Dexie tables. It is
// intentionally a small set of plain async functions — no classes, no
// reactive store. Screens reload the lists when they gain focus.
//
// Limitation: callers must not write from several places at the same
// moment; a save is read-modify-write of the whole list, which is fine for
// a single user tapping one button at a time.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Lesson, ReviewItem, SavedLesson } from '@/types';
import { firstReviewState, nextReviewState } from '@/utils/review-scheduler';

const SAVED_LESSONS_KEY = 'classbreak.savedLessons';
const REVIEW_ITEMS_KEY = 'classbreak.reviewItems';

/** Deterministic id so each lesson has at most one review item. */
function reviewIdFor(lessonId: string): string {
  return `review-${lessonId}`;
}

/** Read a JSON list. Throws (→ screen error state) if storage holds
 *  something unreadable instead of pretending the list is empty. */
async function readList<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Stored data under "${key}" is not a list.`);
  }
  return parsed as T[];
}

async function writeList<T>(key: string, items: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

/** All saved lessons, newest first. */
export async function getSavedLessons(): Promise<SavedLesson[]> {
  const lessons = await readList<SavedLesson>(SAVED_LESSONS_KEY);
  return lessons.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** One saved lesson, or undefined when it does not exist. */
export async function getSavedLesson(id: string): Promise<SavedLesson | undefined> {
  const lessons = await readList<SavedLesson>(SAVED_LESSONS_KEY);
  return lessons.find((lesson) => lesson.id === id);
}

/** Keep a lesson if it is not stored yet. Creates its review schedule
 *  (first review due in one day). Returns the stored record. */
export async function saveLessonIfMissing(lesson: Lesson): Promise<SavedLesson> {
  const lessons = await readList<SavedLesson>(SAVED_LESSONS_KEY);
  const existing = lessons.find((saved) => saved.id === lesson.id);
  if (existing) return existing;

  const saved: SavedLesson = { ...lesson, savedAt: new Date().toISOString() };
  await writeList(SAVED_LESSONS_KEY, [...lessons, saved]);

  // Give the lesson a review slot (one per lesson, keyed by lesson id).
  const reviewItems = await readList<ReviewItem>(REVIEW_ITEMS_KEY);
  const hasReview = reviewItems.some((item) => item.lessonId === lesson.id);
  if (!hasReview) {
    await writeList(REVIEW_ITEMS_KEY, [
      ...reviewItems,
      firstReviewState(reviewIdFor(lesson.id), lesson.id),
    ]);
  }
  return saved;
}

/** Forget a lesson and its review schedule. Safe to call for ids that
 *  are not stored. */
export async function removeSavedLesson(id: string): Promise<void> {
  const lessons = await readList<SavedLesson>(SAVED_LESSONS_KEY);
  await writeList(
    SAVED_LESSONS_KEY,
    lessons.filter((lesson) => lesson.id !== id),
  );

  const reviewItems = await readList<ReviewItem>(REVIEW_ITEMS_KEY);
  await writeList(
    REVIEW_ITEMS_KEY,
    reviewItems.filter((item) => item.lessonId !== id),
  );
}

/** All review schedules. */
export async function getReviewItems(): Promise<ReviewItem[]> {
  return readList<ReviewItem>(REVIEW_ITEMS_KEY);
}

/** Record how a review (or quiz) went and advance the schedule.
 *  No-op when the lesson is not saved — an unsaved lesson has no schedule. */
export async function updateReview(lessonId: string, wasCorrect: boolean): Promise<void> {
  const reviewItems = await readList<ReviewItem>(REVIEW_ITEMS_KEY);
  const index = reviewItems.findIndex((item) => item.lessonId === lessonId);
  if (index === -1) return;

  const updated = nextReviewState(reviewItems[index], wasCorrect);
  const next = [...reviewItems];
  next[index] = updated;
  await writeList(REVIEW_ITEMS_KEY, next);
}
