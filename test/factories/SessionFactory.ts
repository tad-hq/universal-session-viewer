import type { Session } from '@/types/session';

export { createMockSession } from '../mocks/electronAPI';

export function createUnanalyzedSession(overrides: Partial<Session> = {}): Session {
  const id = `unanalyzed-${Math.random().toString(36).slice(2, 11)}`;
  return {
    id,
    session_id: id,
    title: null,
    summary: null,
    project_path: '/Users/test/project',
    projectPath: '/Users/test/project',
    project: 'project',
    modified: Date.now(),
    last_message_time: new Date().toISOString(),
    analysis_timestamp: 0,
    message_count: 5,
    messageCount: 5,
    is_analyzed: 0,
    status: 'pending',
    ...overrides,
  };
}

export function createAnalyzedSession(overrides: Partial<Session> = {}): Session {
  const id = `analyzed-${Math.random().toString(36).slice(2, 11)}`;
  return {
    id,
    session_id: id,
    title: 'Analyzed Session Title',
    summary: '**Main Topic**: Test Analysis\n\n**Key Points**:\n- Point 1\n- Point 2',
    project_path: '/Users/test/project',
    projectPath: '/Users/test/project',
    project: 'project',
    modified: Date.now(),
    last_message_time: new Date().toISOString(),
    analysis_timestamp: Math.floor(Date.now() / 1000),
    message_count: 10,
    messageCount: 10,
    is_analyzed: 1,
    status: 'completed',
    ...overrides,
  };
}

export function createInProgressSession(overrides: Partial<Session> = {}): Session {
  const id = `in-progress-${Math.random().toString(36).slice(2, 11)}`;
  return {
    id,
    session_id: id,
    title: null,
    summary: null,
    project_path: '/Users/test/project',
    projectPath: '/Users/test/project',
    project: 'project',
    modified: Date.now(),
    last_message_time: new Date().toISOString(),
    analysis_timestamp: 0,
    message_count: 7,
    messageCount: 7,
    is_analyzed: 0,
    status: 'in_progress',
    ...overrides,
  };
}

export function createFailedSession(overrides: Partial<Session> = {}): Session {
  const id = `failed-${Math.random().toString(36).slice(2, 11)}`;
  return {
    id,
    session_id: id,
    title: null,
    summary: null,
    project_path: '/Users/test/project',
    projectPath: '/Users/test/project',
    project: 'project',
    modified: Date.now(),
    last_message_time: new Date().toISOString(),
    analysis_timestamp: 0,
    message_count: 8,
    messageCount: 8,
    is_analyzed: 0,
    status: 'failed',
    ...overrides,
  };
}

export function createManySessions(count: number, overrides: Partial<Session> = {}): Session[] {
  return Array.from({ length: count }, (_, index) => {
    const id = `session-${index}-${Math.random().toString(36).slice(2, 9)}`;
    return {
      id,
      session_id: id,
      title: `Session ${index + 1}`,
      summary: `**Main Topic**: Test Session ${index + 1}`,
      project_path: `/Users/test/project-${index % 5}`,
      projectPath: `/Users/test/project-${index % 5}`,
      project: `project-${index % 5}`,
      modified: Date.now() - (count - index) * 60000,
      last_message_time: new Date(Date.now() - (count - index) * 60000).toISOString(),
      analysis_timestamp: Math.floor((Date.now() - (count - index) * 60000) / 1000),
      message_count: 5 + (index % 20),
      messageCount: 5 + (index % 20),
      is_analyzed: index % 3 === 0 ? 1 : 0,
      status: index % 3 === 0 ? 'completed' : 'pending',
      ...overrides,
    };
  });
}

export function createMixedAnalysisStateSessions(
  analyzed: number = 10,
  unanalyzed: number = 10,
  inProgress: number = 5,
  failed: number = 3
): Session[] {
  return [
    ...Array.from({ length: analyzed }, () => createAnalyzedSession()),
    ...Array.from({ length: unanalyzed }, () => createUnanalyzedSession()),
    ...Array.from({ length: inProgress }, () => createInProgressSession()),
    ...Array.from({ length: failed }, () => createFailedSession()),
  ];
}
