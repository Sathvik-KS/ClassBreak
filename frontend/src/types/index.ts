// TypeScript interfaces shared across the frontend

export interface Reference {
  title: string;
  url: string;
  source_type: string;
  extract?: string;
}

export interface LessonSection {
  heading: string;
  content: string;
  key_points: string[];
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  topic: string;
  domain: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration_minutes: number;
  sections: LessonSection[];
  examples: string[];
  takeaways: string[];
  references: Reference[];
  related_topics: string[];
  generated_at: string;
}

export interface SavedLesson extends Lesson {
  savedAt: string;
  isDownloaded: boolean;
}

export interface FeedItem {
  id: string;
  title: string;
  hook: string;
  topic: string;
  domain: string;
  difficulty: string;
  estimated_minutes: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  question_type: 'multiple_choice' | 'open_ended';
}

export interface QuizAttempt {
  id: string;
  lessonId: string;
  questions: QuizQuestion[];
  answers: UserAnswer[];
  score: number;
  completedAt: string;
  synced: boolean;
}

export interface UserAnswer {
  questionId: string;
  answer: string;
  isCorrect: boolean;
  score: number;
  feedback: string;
}

export interface AnswerEvaluation {
  is_correct: boolean;
  score: number;
  feedback: string;
  correct_answer: string;
}

export interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TutorResponse {
  answer: string;
  follow_up_suggestions: string[];
  references: Reference[];
}

export interface ReviewItem {
  id: string;
  lessonId: string;
  nextReviewAt: string;
  interval: number;
  easeFactor: number;
  reviewCount: number;
}

export interface Preferences {
  id: string;
  interests: string[];
  excludedTopics: string[];
  defaultDuration: number;
  theme: 'light' | 'dark' | 'system';
  updatedAt: string;
}

export interface FeedHistoryItem {
  id: string;
  feedItemId: string;
  action: 'seen' | 'dismissed' | 'opened';
  timestamp: string;
}
