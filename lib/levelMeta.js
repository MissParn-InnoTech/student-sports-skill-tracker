export const LEVEL_NAMES = ['', 'Novice', 'Learner', 'Competent', 'Proficient', 'Advanced', 'Elite/Leader'];
export const LEVEL_COLORS = ['', '#94a3b8', '#3b82f6', '#10b981', '#f59e0b', '#f97316', '#ec4899'];
export const SKILL_COLORS = ['#1c7ed6', '#f08c00', '#2f9e44', '#e03131', '#7048e8'];

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return ((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '');
}
