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

export const DOMAIN_COLORS: Record<string, string> = {
  science: 'bg-blue-50 text-blue-700',
  technology: 'bg-purple-50 text-purple-700',
  programming: 'bg-indigo-50 text-indigo-700',
  ai: 'bg-violet-50 text-violet-700',
  engineering: 'bg-slate-50 text-slate-700',
  psychology: 'bg-pink-50 text-pink-700',
  philosophy: 'bg-amber-50 text-amber-700',
  history: 'bg-orange-50 text-orange-700',
  music: 'bg-rose-50 text-rose-700',
  language: 'bg-teal-50 text-teal-700',
  mathematics: 'bg-cyan-50 text-cyan-700',
  biology: 'bg-green-50 text-green-700',
  physics: 'bg-sky-50 text-sky-700',
  economics: 'bg-emerald-50 text-emerald-700',
  art: 'bg-fuchsia-50 text-fuchsia-700',
  literature: 'bg-yellow-50 text-yellow-700',
  general: 'bg-gray-50 text-gray-700',
};
