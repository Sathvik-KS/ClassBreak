// Hook for managing saved lessons in IndexedDB

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { SavedLesson, Lesson, ReviewItem } from '../types';
import { generateId } from '../utils/helpers';

export function useLessons() {
  const savedLessons = useLiveQuery(() =>
    db.lessons.orderBy('savedAt').reverse().toArray()
  ) ?? [];

  const downloadedLessons = useLiveQuery(() =>
    db.lessons.where('isDownloaded').equals(1).toArray()
  ) ?? [];

  const reviewItems = useLiveQuery(() =>
    db.reviewItems.toArray()
  ) ?? [];

  const saveLesson = async (lesson: Lesson) => {
    const existing = await db.lessons.get(lesson.id);
    if (existing) return;

    const saved: SavedLesson = {
      ...lesson,
      savedAt: new Date().toISOString(),
      isDownloaded: false,
    };
    await db.lessons.put(saved);

    // Create a review item for this lesson
    await db.reviewItems.put({
      id: generateId(),
      lessonId: lesson.id,
      nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day
      interval: 1,
      easeFactor: 2.5,
      reviewCount: 0,
    });
  };

  const downloadLesson = async (lessonId: string) => {
    await db.lessons.update(lessonId, { isDownloaded: true });
  };

  const removeDownload = async (lessonId: string) => {
    await db.lessons.update(lessonId, { isDownloaded: false });
  };

  const deleteLesson = async (lessonId: string) => {
    await db.lessons.delete(lessonId);
    await db.reviewItems.where('lessonId').equals(lessonId).delete();
    await db.quizAttempts.where('lessonId').equals(lessonId).delete();
  };

  const isLessonSaved = (lessonId: string): boolean => {
    return savedLessons.some(l => l.id === lessonId);
  };

  const getLesson = async (lessonId: string): Promise<SavedLesson | undefined> => {
    return db.lessons.get(lessonId);
  };

  // Basic review scheduling update
  const updateReview = async (lessonId: string, wasCorrect: boolean) => {
    const item = await db.reviewItems.where('lessonId').equals(lessonId).first();
    if (!item) return;

    let { interval, easeFactor, reviewCount } = item;
    reviewCount += 1;

    if (wasCorrect) {
      if (reviewCount === 1) interval = 1;
      else if (reviewCount === 2) interval = 3;
      else interval = Math.round(interval * easeFactor);
      easeFactor = Math.max(1.3, easeFactor + 0.1);
    } else {
      interval = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
    }

    const nextReviewAt = new Date(Date.now() + interval * 24 * 60 * 60 * 1000).toISOString();

    await db.reviewItems.update(item.id, {
      interval,
      easeFactor,
      reviewCount,
      nextReviewAt,
    });
  };

  const getDueReviews = (): ReviewItem[] => {
    const now = new Date().toISOString();
    return reviewItems.filter(r => r.nextReviewAt <= now);
  };

  return {
    savedLessons,
    downloadedLessons,
    reviewItems,
    saveLesson,
    downloadLesson,
    removeDownload,
    deleteLesson,
    isLessonSaved,
    getLesson,
    updateReview,
    getDueReviews,
  };
}
