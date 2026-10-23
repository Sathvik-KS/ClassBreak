// Domain -> color mapping, conceptually ported from
// frontend/src/utils/helpers.ts. That version returns CSS class names for
// the web app; here we return concrete hex colors usable in React Native.

const DOMAIN_COLORS: Record<string, string> = {
  science: '#3b82f6',
  physics: '#3b82f6',
  biology: '#22c55e',
  mathematics: '#06b6d4',
  technology: '#a855f7',
  programming: '#6366f1',
  ai: '#8b5cf6',
  'computer science': '#6366f1',
  engineering: '#64748b',
  psychology: '#ec4899',
  philosophy: '#f59e0b',
  history: '#f97316',
  music: '#f43f5e',
  language: '#14b8a6',
  economics: '#10b981',
  art: '#d946ef',
  literature: '#eab308',
};

export function getDomainColor(domain: string): string {
  return DOMAIN_COLORS[domain.toLowerCase()] ?? '#6b7280';
}

export function getDifficultyLabel(difficulty: string): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}
