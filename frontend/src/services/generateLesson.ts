// One shared flow: generate a lesson on the backend, then persist it locally.
// Used by the Discover feed and by "related topic" chips in the lesson view.

import { api } from './api';
import { saveLessonIfMissing } from './lessonStore';
import { normalizeDifficulty } from '../utils/helpers';
import type { Lesson } from '../types';

export async function generateAndSaveLesson(
  topic: string,
  durationMinutes: number,
  depth: string,
): Promise<Lesson> {
  const lesson = await api.generateLesson({
    topic,
    duration_minutes: durationMinutes,
    depth: normalizeDifficulty(depth),
  });
  await saveLessonIfMissing(lesson);
  return lesson;
}
