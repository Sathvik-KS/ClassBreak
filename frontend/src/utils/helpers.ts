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

export function getDomainColor(domain: string): string {
  const colors: Record<string, string> = {
    science: 'bg-blue-50 text-blue-700',
    technology: 'bg-purple-50 text-purple-700',
    programming: 'bg-indigo-50 text-indigo-700',
    ai: 'bg-violet-50 text-violet-700',
    engineering: 'bg-slate-100 text-slate-700',
    psychology: 'bg-pink-50 text-pink-700',
    philosophy: 'bg-amber-50 text-amber-700',
    history: 'bg-orange-50 text-orange-700',
    music: 'bg-rose-50 text-rose-700',
    language: 'bg-teal-50 text-teal-700',
    mathematics: 'bg-cyan-50 text-cyan-700',
    'computer science': 'bg-indigo-50 text-indigo-700',
  };
  return colors[domain.toLowerCase()] || 'bg-gray-50 text-gray-700';
}

export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'beginner': return 'text-emerald-700 bg-emerald-50';
    case 'intermediate': return 'text-amber-700 bg-amber-50';
    case 'advanced': return 'text-red-700 bg-red-50';
    default: return 'text-gray-700 bg-gray-50';
  }
}

/** Build lesson content string for quiz/tutor context */
export function lessonToContext(lesson: { title: string; sections: { heading: string; content: string }[]; takeaways: string[] }): string {
  const sectionText = lesson.sections.map(s => `## ${s.heading}\n${s.content}`).join('\n\n');
  const takeawayText = lesson.takeaways.length ? `\n\nKey Takeaways:\n${lesson.takeaways.map(t => `- ${t}`).join('\n')}` : '';
  return `# ${lesson.title}\n\n${sectionText}${takeawayText}`;
}
