// COPIED VERBATIM from v1 index.html lines 1455-1482
// DO NOT MODIFY - These are exact copies of v1 logic

import { logger } from './logger';

import type { Session } from '../types/session';
import type { Settings } from '../types/settings';

/**
 * Sort sessions based on settings
 * Source: v1 index.html lines 1455-1482
 */
export function sortSessions(sessionsArray: Session[], settings: Settings | null): Session[] {
  if (!settings || !settings.defaultSortOrder) {
    return sessionsArray.sort((a, b) => b.modified - a.modified);
  }

  const sortOrder = settings.defaultSortOrder;

  switch (sortOrder) {
    case 'modified':
      return sessionsArray.sort((a, b) => b.modified - a.modified);

    case 'created':
      // Fallback: 'created' field doesn't exist, use 'modified'
      logger.warn('Sort by created unavailable, using modified');
      return sessionsArray.sort((a, b) => b.modified - a.modified);

    case 'project':
      return sessionsArray.sort((a, b) => {
        const projectA = (a.projectPath || a.project || '').toLowerCase();
        const projectB = (b.projectPath || b.project || '').toLowerCase();
        return projectA.localeCompare(projectB);
      });

    default:
      logger.warn(`Unknown sort order: ${sortOrder}, using modified`);
      return sessionsArray.sort((a, b) => b.modified - a.modified);
  }
}
