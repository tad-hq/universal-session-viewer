export type TerminalApplication = 'Terminal.app' | 'gnome-terminal' | 'Ghostty' | 'custom';

export interface PathPreferences {
  claudeProjects: string;
  sessionViewerData: string;
  promptsDirectory: string;
  additionalDiscoveryPaths: string[];
  excludePaths: string[];
}

export interface TerminalPreferences {
  application: TerminalApplication;
  useTmux: boolean;
  tmuxSessionPrefix: string;
  customLaunchCommand?: string;
}

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';

export interface ClaudeCodeSettings {
  binaryPath: string;
  dangerouslySkipPermissions: boolean;
  model: string;
  permissionMode: PermissionMode;
  appendSystemPrompt: string;
  maxTurns: number;
  autoResume: boolean;
}

export const CLAUDE_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fast)', tier: 'fast' },
  { id: 'claude-sonnet-4-5-20241022', label: 'Claude Sonnet 4.5 (Balanced)', tier: 'standard' },
  { id: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5 (Premium)', tier: 'premium' },
] as const;

export const DEFAULT_CLAUDE_CODE_SETTINGS: ClaudeCodeSettings = {
  binaryPath: 'claude',
  dangerouslySkipPermissions: false,
  model: 'claude-haiku-4-5-20251001',
  permissionMode: 'default',
  appendSystemPrompt: '',
  maxTurns: 0,
  autoResume: false,
};

export interface Settings {
  dailyAnalysisLimit: number;
  autoAnalyzeNewSessions: boolean;
  cacheDurationDays: number;
  bypassQuotaOnForceAnalyze: boolean;

  showSessionTimestamps: boolean;
  showProjectPaths: boolean;
  defaultSortOrder: 'modified' | 'created' | 'project';

  groupContinuations: boolean;
  showContinuationBadges: boolean;
  collapseGroupsByDefault: boolean;

  maxConcurrentAnalyses: number;
  analysisTimeout: number;
  enableDebugLogging: boolean;

  terminal: TerminalPreferences;
  paths: PathPreferences;
  claudeCode: ClaudeCodeSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  dailyAnalysisLimit: 20,
  autoAnalyzeNewSessions: false,
  cacheDurationDays: 30,
  bypassQuotaOnForceAnalyze: false,
  showSessionTimestamps: true,
  showProjectPaths: true,
  defaultSortOrder: 'modified',
  groupContinuations: true,
  showContinuationBadges: true,
  collapseGroupsByDefault: false,
  maxConcurrentAnalyses: 1,
  analysisTimeout: 600000,
  enableDebugLogging: false,

  terminal: {
    application: 'Terminal.app',
    useTmux: false,
    tmuxSessionPrefix: 'claude-',
  },

  paths: {
    claudeProjects: '~/.claude/projects',
    sessionViewerData: '~/.universal-session-viewer',
    promptsDirectory: '~/.claude/prompts',
    additionalDiscoveryPaths: [],
    excludePaths: [],
  },

  claudeCode: DEFAULT_CLAUDE_CODE_SETTINGS,
};
