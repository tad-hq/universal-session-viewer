import type {
  Session,
  SessionDetails,
  SessionFilters,
  Project,
  PromptFile,
  ContinuationChain,
  ContinuationMetadata,
  ContinuationStats,
  SessionWithContinuations,
} from './session';
import type { Settings, TerminalApplication, TerminalPreferences } from './settings';

export type CleanupFunction = () => void;

export interface QuotaInfo {
  current: number;
  limit: number;
  allowed: boolean;
  message: string;
}

export interface AnalysisStatus {
  status: 'analyzing' | 'loading';
  message: string;
  current?: number;
  total?: number;
}

export interface BulkAnalyzeProgress {
  current: number;
  total: number;
  sessionId: string;
  status: 'analyzing' | 'success' | 'failed' | 'skipped';
  error?: string;
}

export interface BulkAnalyzeComplete {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  errors: Array<{ sessionId: string; error: string }>;
}

export interface ErrorEntry {
  id: string;
  error: {
    name: string;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    severity: 'critical' | 'error' | 'warning';
    stack?: string;
  };
  read: boolean;
  addedAt: number;
}

export interface SessionsUpdatedPayload {
  added: number;
  updated: number;
  removed: number;
}

export interface DiscoveryCompletePayload {
  message: string;
}

export interface ContinuationDetectionProgress {
  current: number;
  total: number;
  percentage: number;
  batch: number;
  totalBatches: number;
  message?: string;
}

export interface ContinuationsDetected {
  total: number;
  chains: number;
  orphaned: number;
  maxDepth: number;
}

export interface ContinuationsUpdated {
  type: 'realtime' | 'fullRefresh';
  count?: number;
  stats?: {
    chains: number;
    orphaned: number;
    maxDepth: number;
  };
}

export interface ResolveContinuationChainsResponse {
  success: boolean;
  stats?: ContinuationsDetected;
  error?: string;
}

export interface ContinuationGroupInfo {
  rootSessionId: string;
  sessionIds: string[];
  depth: number;
  isRoot: boolean;
  isContinuation: boolean;
}

export interface ElectronAPI {
  onSessionsUpdated: (
    callback: (event: unknown, data: SessionsUpdatedPayload) => void
  ) => CleanupFunction;
  onSessionUpdated: (callback: (event: unknown, session: Session) => void) => CleanupFunction;
  onDiscoveryComplete: (
    callback: (event: unknown, data: DiscoveryCompletePayload) => void
  ) => CleanupFunction;
  onAnalysisStatus: (callback: (event: unknown, data: AnalysisStatus) => void) => CleanupFunction;
  onAnalysisComplete: (
    callback: (event: unknown, data: { message: string }) => void
  ) => CleanupFunction;
  onAnalysisError: (callback: (event: unknown, data: { error: string }) => void) => CleanupFunction;

  onMenuRefresh: (callback: (event: unknown) => void) => CleanupFunction;
  onMenuFocusSearch: (callback: (event: unknown) => void) => CleanupFunction;
  onMenuOpenSettings: (callback: (event: unknown) => void) => CleanupFunction;

  onMainProcessError: (
    callback: (
      event: unknown,
      error: {
        code: string;
        message: string;
        severity: 'critical' | 'error' | 'warning';
        timestamp: string;
      }
    ) => void
  ) => CleanupFunction;

  getRecentErrors: (count?: number) => Promise<{
    success: boolean;
    errors: ErrorEntry[];
    error?: string;
  }>;

  getAllErrors: () => Promise<{
    success: boolean;
    errors: ErrorEntry[];
    error?: string;
  }>;

  getUnreadErrors: () => Promise<{
    success: boolean;
    errors: ErrorEntry[];
    error?: string;
  }>;

  markErrorRead: (id: string) => Promise<{
    success: boolean;
    error?: string;
  }>;

  markAllErrorsRead: () => Promise<{
    success: boolean;
    error?: string;
  }>;

  clearErrors: () => Promise<{
    success: boolean;
    error?: string;
  }>;

  copyErrorToClipboard: (errorId: string) => Promise<{
    success: boolean;
    error?: string;
  }>;

  rendererReady: () => Promise<{ success: boolean }>;
  getSessionDetails: (
    sessionId: string,
    loadFullMessages?: boolean
  ) => Promise<{
    success: boolean;
    session?: SessionDetails;
    error?: string;
  }>;
  refreshSessions: () => Promise<{ success: boolean; error?: string } | void>;
  openSessionFolder: (sessionPath: string) => Promise<{ success: boolean; error?: string }>;
  getAvailablePrompts: () => Promise<PromptFile[]>;
  resumeSession: (
    sessionId: string,
    promptFile: string | undefined,
    useTmux: boolean
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;
  reanalyzeSession: (
    sessionId: string,
    customInstructions?: string,
    bypassQuota?: boolean
  ) => Promise<{
    success: boolean;
    summary?: string;
    title?: string | null;
    error?: string;
  }>;

  getSettings: () => Promise<{ success: boolean; settings: Settings; error?: string }>;
  saveSettings: (settings: Settings) => Promise<{ success: boolean; error?: string }>;
  saveSetting: (key: string, value: unknown) => Promise<{ success: boolean; error?: string }>;

  getQuota: () => Promise<{ success: boolean; quota: QuotaInfo; error?: string }>;
  getQuotaStats: (days: number) => Promise<unknown>;

  clearAllCache: () => Promise<{ success: boolean; cleared: number; error?: string }>;

  searchSessions: (
    query: string,
    limit: number,
    offset: number
  ) => Promise<{
    success: boolean;
    sessions: Session[];
    total: number;
    error?: string;
  }>;
  loadSessionsPaginated: (
    limit: number,
    offset: number,
    filters: SessionFilters
  ) => Promise<{
    success: boolean;
    sessions: Session[];
    total: number;
    hasMore: boolean;
    error?: string;
  }>;
  getSessionCount: (filters: SessionFilters) => Promise<{ count: number }>;
  getAvailableProjects: (filters: { dateFrom?: string | null; dateTo?: string | null }) => Promise<{
    success: boolean;
    projects: Project[];
    error?: string;
  }>;

  bulkAnalyzeSessions: (
    sessionIds: string[],
    bypassQuota: boolean
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;
  cancelBulkAnalyze: () => Promise<{ success: boolean }>;
  onBulkAnalyzeProgress: (
    callback: (event: unknown, data: BulkAnalyzeProgress) => void
  ) => CleanupFunction;
  onBulkAnalyzeComplete: (
    callback: (event: unknown, data: BulkAnalyzeComplete) => void
  ) => CleanupFunction;

  openSessionsTmux4: (sessionIds: string[]) => Promise<{
    success: boolean;
    error?: string;
  }>;

  getContinuationChain: (sessionId: string) => Promise<{
    success: boolean;
    chain: ContinuationChain | null;
    error?: string;
  }>;

  getContinuationChildren: (sessionId: string) => Promise<{
    success: boolean;
    children: Session[];
    error?: string;
  }>;

  getSessionWithContinuations: (
    sessionId: string,
    loadFullMessages?: boolean
  ) => Promise<{
    success: boolean;
    session: SessionWithContinuations | null;
    error?: string;
  }>;

  getContinuationMetadata: (sessionId: string) => Promise<{
    success: boolean;
    metadata: ContinuationMetadata | null;
    error?: string;
  }>;

  getContinuationStats: () => Promise<{
    success: boolean;
    stats: ContinuationStats | null;
    error?: string;
  }>;

  onContinuationDetectionProgress: (
    callback: (event: unknown, data: ContinuationDetectionProgress) => void
  ) => CleanupFunction;

  onContinuationsDetected: (
    callback: (event: unknown, data: ContinuationsDetected) => void
  ) => CleanupFunction;

  onContinuationsUpdated: (
    callback: (event: unknown, data: ContinuationsUpdated) => void
  ) => CleanupFunction;

  resolveContinuationChains: () => Promise<ResolveContinuationChainsResponse>;

  getContinuationGroup: (sessionId: string) => Promise<{
    success: boolean;
    group: ContinuationGroupInfo | null;
    error?: string;
  }>;

  getPlatform: () => Promise<{
    success: boolean;
    platform: 'darwin' | 'linux' | 'win32';
    error?: string;
  }>;

  getTerminalSettings: () => Promise<{
    success: boolean;
    terminal: TerminalPreferences;
    platform: 'darwin' | 'linux' | 'win32';
    error?: string;
  }>;

  checkTerminalAvailable: (terminal: TerminalApplication) => Promise<{
    success: boolean;
    available: boolean;
    error?: string;
  }>;

  validatePath: (inputPath: string) => Promise<{
    valid: boolean;
    expandedPath: string;
    error?: string;
  }>;

  browseDirectory: () => Promise<{
    canceled: boolean;
    path?: string;
  }>;

  onPathWarning: (
    callback: (
      event: unknown,
      data: {
        path: string;
        message: string;
        severity: 'warning' | 'error';
      }
    ) => void
  ) => CleanupFunction;

  validateBinaryPath: (path: string) => Promise<{
    valid: boolean;
    error?: string;
  }>;

  getMostRecentSession: () => Promise<{
    success: boolean;
    session?: {
      sessionId: string;
      projectPath: string;
      title: string | null;
    } | null;
    error?: string;
  }>;

  removeAllListeners: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
