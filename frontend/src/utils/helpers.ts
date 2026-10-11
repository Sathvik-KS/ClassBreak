// Utility helpers

export function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

// NOTE: no Tailwind in this project — these return semantic CSS class
// names defined in src/App.css.
const DOMAIN_CLASSES: Record<string, string> = {
  science: 'chip-blue',
  physics: 'chip-blue',
  biology: 'chip-green',
  mathematics: 'chip-cyan',
  technology: 'chip-purple',
  programming: 'chip-indigo',
  ai: 'chip-violet',
  'computer science': 'chip-indigo',
  engineering: 'chip-slate',
  psychology: 'chip-pink',
  philosophy: 'chip-amber',
  history: 'chip-orange',
  music: 'chip-rose',
  language: 'chip-teal',
  economics: 'chip-emerald',
  art: 'chip-fuchsia',
  literature: 'chip-yellow',
};

export function getDomainColor(domain: string): string {
  return DOMAIN_CLASSES[domain.toLowerCase()] || 'chip-gray';
}

export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'beginner': return 'diff-beginner';
    case 'intermediate': return 'diff-intermediate';
    case 'advanced': return 'diff-advanced';
    default: return 'diff-default';
  }
}

export function normalizeDifficulty(d: string): 'beginner' | 'intermediate' | 'advanced' {
  return d === 'intermediate' || d === 'advanced' ? d : 'beginner';
}

/** Build lesson content string for quiz/tutor context */
export function lessonToContext(lesson: { title: string; sections: { heading: string; content: string }[]; takeaways: string[] }): string {
  const sectionText = lesson.sections.map(s => `## ${s.heading}\n${s.content}`).join('\n\n');
  const takeawayText = lesson.takeaways.length ? `\n\nKey Takeaways:\n${lesson.takeaways.map(t => `- ${t}`).join('\n')}` : '';
  return `# ${lesson.title}\n\n${sectionText}${takeawayText}`;
}
