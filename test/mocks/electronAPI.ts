import { vi, type Mock } from 'vitest';
import type {
  Session,
  SessionDetails,
  SessionFilters,
  Project,
  PromptFile,
} from '@/types/session';
import type { Settings } from '@/types/settings';
import type { ElectronAPI, QuotaInfo, AnalysisStatus } from '@/types/ipc';

export function createMockSession(overrides: Partial<Session> = {}): Session {
  const id = overrides.id ?? `session-${Math.random().toString(36).slice(2, 11)}`;
  return {
    id,
    session_id: id,
    title: 'Test Session Title',
    summary: '**Main Topic/Domain**: Testing mock sessions',
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

export function createMockSessionDetails(
  overrides: Partial<SessionDetails> = {}
): SessionDetails {
  const session = createMockSession(overrides);
  return {
    ...session,
    messages: [
      { type: 'user', content: 'Hello, Claude!', timestamp: new Date().toISOString() },
      { type: 'assistant', content: 'Hello! How can I help you today?', timestamp: new Date().toISOString() },
    ],
    fullMessagesLoaded: true,
    ...overrides,
  };
}

export function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    project_path: '/Users/test/project',
    session_count: 5,
    ...overrides,
  };
}

export function createMockSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    dailyAnalysisLimit: 20,
    autoAnalyzeNewSessions: false,
    cacheDurationDays: 30,
    showSessionTimestamps: true,
    showProjectPaths: true,
    defaultSortOrder: 'modified',
    maxConcurrentAnalyses: 1,
    analysisTimeout: 600000,
    enableDebugLogging: false,
    ...overrides,
  };
}

export function createMockQuotaInfo(overrides: Partial<QuotaInfo> = {}): QuotaInfo {
  return {
    current: 50,
    limit: 100,
    allowed: true,
    message: 'Quota OK',
    ...overrides,
  };
}

export function createMockPromptFile(overrides: Partial<PromptFile> = {}): PromptFile {
  return {
    filename: 'default.md',
    displayName: 'Default Prompt',
    ...overrides,
  };
}

type EventCallback = (event: unknown, data: unknown) => void;

interface EventListeners {
  'sessions-loaded': EventCallback[];
  'session-updated': EventCallback[];
  'analysis-status': EventCallback[];
  'analysis-complete': EventCallback[];
  'analysis-error': EventCallback[];
}

let eventListeners: EventListeners = {
  'sessions-loaded': [],
  'session-updated': [],
  'analysis-status': [],
  'analysis-complete': [],
  'analysis-error': [],
};

export interface MockResponses {
  sessions: Session[];
  sessionDetails: SessionDetails | null;
  projects: Project[];
  settings: Settings;
  quota: QuotaInfo;
  prompts: PromptFile[];
  searchResults: Session[];
  errors: {
    getSessions: string | null;
    getSessionDetails: string | null;
    search: string | null;
    saveSettings: string | null;
  };
}

let mockResponses: MockResponses = {
  sessions: [createMockSession()],
  sessionDetails: createMockSessionDetails(),
  projects: [createMockProject()],
  settings: createMockSettings(),
  quota: createMockQuotaInfo(),
  prompts: [createMockPromptFile()],
  searchResults: [createMockSession({ title: 'Search Result' })],
  errors: {
    getSessions: null,
    getSessionDetails: null,
    search: null,
    saveSettings: null,
  },
};

export function configureMockResponses(config: Partial<MockResponses>): void {
  mockResponses = { ...mockResponses, ...config };
}

export function resetMockResponses(): void {
  mockResponses = {
    sessions: [createMockSession()],
    sessionDetails: createMockSessionDetails(),
    projects: [createMockProject()],
    settings: createMockSettings(),
    quota: createMockQuotaInfo(),
    prompts: [createMockPromptFile()],
    searchResults: [createMockSession({ title: 'Search Result' })],
    errors: {
      getSessions: null,
      getSessionDetails: null,
      search: null,
      saveSettings: null,
    },
  };
}

export function simulateEvent(
  eventName: keyof EventListeners,
  data: unknown
): void {
  const callbacks = eventListeners[eventName];
  callbacks.forEach((callback) => {
    callback({}, data);
  });
}

export function simulateSessionsLoaded(sessions: Session[]): void {
  simulateEvent('sessions-loaded', sessions);
}

export function simulateSessionUpdated(session: Session): void {
  simulateEvent('session-updated', session);
}

export function simulateAnalysisStatus(status: AnalysisStatus): void {
  simulateEvent('analysis-status', status);
}

export function simulateAnalysisComplete(message: string): void {
  simulateEvent('analysis-complete', { message });
}

export function simulateAnalysisError(error: string): void {
  simulateEvent('analysis-error', { error });
}

export interface MockElectronAPI extends ElectronAPI {
  __mocks__: {
    rendererReady: Mock;
    getSessionDetails: Mock;
    refreshSessions: Mock;
    openSessionFolder: Mock;
    getAvailablePrompts: Mock;
    resumeSession: Mock;
    reanalyzeSession: Mock;
    getSettings: Mock;
    saveSettings: Mock;
    saveSetting: Mock;
    getQuota: Mock;
    getQuotaStats: Mock;
    clearAllCache: Mock;
    searchSessions: Mock;
    loadSessionsPaginated: Mock;
    getSessionCount: Mock;
    getAvailableProjects: Mock;
    removeAllListeners: Mock;
  };
}

export function createMockElectronAPI(): MockElectronAPI {
  const mocks = {
    rendererReady: vi.fn().mockResolvedValue(undefined),

    getSessionDetails: vi.fn().mockImplementation(
      async (sessionId: string, _loadFullMessages?: boolean) => {
        if (mockResponses.errors.getSessionDetails) {
          return {
            success: false,
            error: mockResponses.errors.getSessionDetails,
          };
        }
        if (mockResponses.sessionDetails && mockResponses.sessionDetails.id === sessionId) {
          return { success: true, session: mockResponses.sessionDetails };
        }
        return {
          success: true,
          session: createMockSessionDetails({ id: sessionId }),
        };
      }
    ),

    refreshSessions: vi.fn().mockResolvedValue(undefined),

    openSessionFolder: vi.fn().mockResolvedValue(undefined),

    getAvailablePrompts: vi.fn().mockResolvedValue(mockResponses.prompts),

    resumeSession: vi.fn().mockResolvedValue({ success: true }),

    reanalyzeSession: vi.fn().mockResolvedValue({ success: true }),

    getSettings: vi.fn().mockImplementation(async () => ({
      success: true,
      settings: mockResponses.settings,
    })),

    saveSettings: vi.fn().mockImplementation(async (_settings: Settings) => {
      if (mockResponses.errors.saveSettings) {
        return { success: false, error: mockResponses.errors.saveSettings };
      }
      return { success: true };
    }),

    saveSetting: vi.fn().mockResolvedValue({ success: true }),

    getQuota: vi.fn().mockImplementation(async () => ({
      success: true,
      quota: mockResponses.quota,
    })),

    getQuotaStats: vi.fn().mockResolvedValue({ stats: [] }),

    clearAllCache: vi.fn().mockResolvedValue({ success: true, cleared: 10 }),

    searchSessions: vi.fn().mockImplementation(
      async (query: string, limit: number, _offset: number) => {
        if (mockResponses.errors.search) {
          return { success: false, error: mockResponses.errors.search, sessions: [], total: 0 };
        }
        const results = mockResponses.searchResults.filter(
          (s) =>
            s.title?.toLowerCase().includes(query.toLowerCase()) ||
            s.summary?.toLowerCase().includes(query.toLowerCase())
        );
        return {
          success: true,
          sessions: results.slice(0, limit),
          total: results.length,
        };
      }
    ),

    loadSessionsPaginated: vi.fn().mockImplementation(
      async (limit: number, offset: number, _filters: SessionFilters) => {
        if (mockResponses.errors.getSessions) {
          return {
            success: false,
            error: mockResponses.errors.getSessions,
            sessions: [],
            total: 0,
            hasMore: false,
          };
        }
        const sessions = mockResponses.sessions.slice(offset, offset + limit);
        return {
          success: true,
          sessions,
          total: mockResponses.sessions.length,
          hasMore: offset + limit < mockResponses.sessions.length,
        };
      }
    ),

    getSessionCount: vi.fn().mockImplementation(async (_filters: SessionFilters) => ({
      count: mockResponses.sessions.length,
    })),

    getAvailableProjects: vi.fn().mockImplementation(async () => ({
      success: true,
      projects: mockResponses.projects,
    })),

    removeAllListeners: vi.fn().mockImplementation(() => {
      eventListeners = {
        'sessions-loaded': [],
        'session-updated': [],
        'analysis-status': [],
        'analysis-complete': [],
        'analysis-error': [],
      };
    }),
  };

  const mockAPI: MockElectronAPI = {
    onSessionsLoaded: (callback: (event: unknown, data: Session[]) => void) => {
      eventListeners['sessions-loaded'].push(callback as EventCallback);
    },
    onSessionUpdated: (callback: (event: unknown, session: Session) => void) => {
      eventListeners['session-updated'].push(callback as EventCallback);
    },
    onAnalysisStatus: (callback: (event: unknown, data: AnalysisStatus) => void) => {
      eventListeners['analysis-status'].push(callback as EventCallback);
    },
    onAnalysisComplete: (callback: (event: unknown, data: { message: string }) => void) => {
      eventListeners['analysis-complete'].push(callback as EventCallback);
    },
    onAnalysisError: (callback: (event: unknown, data: { error: string }) => void) => {
      eventListeners['analysis-error'].push(callback as EventCallback);
    },

    rendererReady: mocks.rendererReady,
    getSessionDetails: mocks.getSessionDetails,
    refreshSessions: mocks.refreshSessions,
    openSessionFolder: mocks.openSessionFolder,
    getAvailablePrompts: mocks.getAvailablePrompts,
    resumeSession: mocks.resumeSession,
    reanalyzeSession: mocks.reanalyzeSession,
    getSettings: mocks.getSettings,
    saveSettings: mocks.saveSettings,
    saveSetting: mocks.saveSetting,
    getQuota: mocks.getQuota,
    getQuotaStats: mocks.getQuotaStats,
    clearAllCache: mocks.clearAllCache,
    searchSessions: mocks.searchSessions,
    loadSessionsPaginated: mocks.loadSessionsPaginated,
    getSessionCount: mocks.getSessionCount,
    getAvailableProjects: mocks.getAvailableProjects,
    removeAllListeners: mocks.removeAllListeners,

    __mocks__: mocks,
  };

  return mockAPI;
}

export function resetAllMocks(): void {
  resetMockResponses();
  eventListeners = {
    'sessions-loaded': [],
    'session-updated': [],
    'analysis-status': [],
    'analysis-complete': [],
    'analysis-error': [],
  };
}

export function getEventListenerCounts(): Record<keyof EventListeners, number> {
  return {
    'sessions-loaded': eventListeners['sessions-loaded'].length,
    'session-updated': eventListeners['session-updated'].length,
    'analysis-status': eventListeners['analysis-status'].length,
    'analysis-complete': eventListeners['analysis-complete'].length,
    'analysis-error': eventListeners['analysis-error'].length,
  };
}
