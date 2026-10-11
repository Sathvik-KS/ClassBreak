// Default interests and domain definitions

export const DOMAINS = [
  { id: 'science', label: 'Science', emoji: '🔬' },
  { id: 'technology', label: 'Technology', emoji: '💻' },
  { id: 'programming', label: 'Programming', emoji: '👨‍💻' },
  { id: 'ai', label: 'AI & ML', emoji: '🤖' },
  { id: 'engineering', label: 'Engineering', emoji: '⚙️' },
  { id: 'psychology', label: 'Psychology', emoji: '🧠' },
  { id: 'philosophy', label: 'Philosophy', emoji: '🤔' },
  { id: 'history', label: 'History', emoji: '📜' },
  { id: 'music', label: 'Music & Piano', emoji: '🎹' },
  { id: 'language', label: 'Languages', emoji: '🌍' },
  { id: 'mathematics', label: 'Mathematics', emoji: '📐' },
  { id: 'biology', label: 'Biology', emoji: '🧬' },
  { id: 'physics', label: 'Physics', emoji: '⚛️' },
  { id: 'economics', label: 'Economics', emoji: '📊' },
  { id: 'art', label: 'Art & Design', emoji: '🎨' },
  { id: 'literature', label: 'Literature', emoji: '📚' },
] as const;

export const SESSION_DURATIONS = [
  { value: 2, label: '2 min', description: 'Quick fact' },
  { value: 5, label: '5 min', description: 'Short lesson' },
  { value: 10, label: '10 min', description: 'Deep dive' },
] as const;

export const DIFFICULTY_LEVELS = [
  { value: 'beginner', label: 'Beginner', color: 'text-emerald-600 bg-emerald-50' },
  { value: 'intermediate', label: 'Intermediate', color: 'text-amber-600 bg-amber-50' },
  { value: 'advanced', label: 'Advanced', color: 'text-red-600 bg-red-50' },
] as const;

// NOTE: domain → chip color mapping lives in utils/helpers.ts (getDomainColor)
// to avoid duplicate tables drifting apart.
