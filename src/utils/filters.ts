// COPIED VERBATIM from v1 index.html lines 1355-1380
// DO NOT MODIFY - These are exact copies of v1 logic

import type { Session } from '../types/session';

/**
 * Get unique project paths from sessions
 * Source: v1 index.html lines 1355-1367
 */
export function getUniqueProjects(sessions: Session[]): string[] {
  const projectSet = new Set<string>();

  sessions.forEach((session) => {
    if (session.projectPath && typeof session.projectPath === 'string') {
      projectSet.add(session.projectPath);
    }
  });

  return Array.from(projectSet).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

/**
 * Get session count by project
 * Source: v1 index.html lines 1369-1380
 */
export function getSessionCountByProject(sessions: Session[]): Map<string, number> {
  const counts = new Map<string, number>();

  sessions.forEach((session) => {
    if (session.projectPath) {
      const current = counts.get(session.projectPath) ?? 0;
      counts.set(session.projectPath, current + 1);
    }
  });

  return counts;
}
