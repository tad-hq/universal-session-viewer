const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onSessionsUpdated: (callback) => {
    ipcRenderer.on('sessions-updated', callback);
    return () => ipcRenderer.removeListener('sessions-updated', callback);
  },
  onSessionUpdated: (callback) => {
    ipcRenderer.on('session-updated', callback);
    return () => ipcRenderer.removeListener('session-updated', callback);
  },
  onDiscoveryComplete: (callback) => {
    ipcRenderer.on('discovery-complete', callback);
    return () => ipcRenderer.removeListener('discovery-complete', callback);
  },
  onAnalysisStatus: (callback) => {
    ipcRenderer.on('analysis-status', callback);
    return () => ipcRenderer.removeListener('analysis-status', callback);
  },
  onAnalysisComplete: (callback) => {
    ipcRenderer.on('analysis-complete', callback);
    return () => ipcRenderer.removeListener('analysis-complete', callback);
  },
  onAnalysisError: (callback) => {
    ipcRenderer.on('analysis-error', callback);
    return () => ipcRenderer.removeListener('analysis-error', callback);
  },

  onMenuRefresh: (callback) => {
    ipcRenderer.on('menu:refresh', callback);
    return () => ipcRenderer.removeListener('menu:refresh', callback);
  },
  onMenuFocusSearch: (callback) => {
    ipcRenderer.on('menu:focus-search', callback);
    return () => ipcRenderer.removeListener('menu:focus-search', callback);
  },
  onMenuOpenSettings: (callback) => {
    ipcRenderer.on('menu:open-settings', callback);
    return () => ipcRenderer.removeListener('menu:open-settings', callback);
  },

  onMainProcessError: (callback) => {
    ipcRenderer.on('main-process-error', callback);
    return () => ipcRenderer.removeListener('main-process-error', callback);
  },

  getRecentErrors: (count = 10) => ipcRenderer.invoke('get-recent-errors', count),
  getAllErrors: () => ipcRenderer.invoke('get-all-errors'),
  getUnreadErrors: () => ipcRenderer.invoke('get-unread-errors'),
  markErrorRead: (id) => ipcRenderer.invoke('mark-error-read', id),
  markAllErrorsRead: () => ipcRenderer.invoke('mark-all-errors-read'),
  clearErrors: () => ipcRenderer.invoke('clear-errors'),
  copyErrorToClipboard: (errorId) => ipcRenderer.invoke('copy-error-to-clipboard', errorId),

  rendererReady: () => ipcRenderer.invoke('renderer-ready'),
  getSessionDetails: (sessionId, loadFullMessages) =>
    ipcRenderer.invoke('get-session-details', sessionId, loadFullMessages),
  refreshSessions: () => ipcRenderer.invoke('refresh-sessions'),
  openSessionFolder: (sessionPath) => ipcRenderer.invoke('open-session-folder', sessionPath),
  getAvailablePrompts: () => ipcRenderer.invoke('get-available-prompts'),
  resumeSession: (sessionId, promptFile, useTmux) => {
    return ipcRenderer.invoke('resume-session', sessionId, promptFile, useTmux);
  },
  reanalyzeSession: (sessionId, customInstructions, bypassQuota) =>
    ipcRenderer.invoke('reanalyze-session', sessionId, customInstructions, bypassQuota),

  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  saveSetting: (key, value) => ipcRenderer.invoke('save-setting', key, value),

  getQuota: () => ipcRenderer.invoke('get-quota'),
  getQuotaStats: (days) => ipcRenderer.invoke('get-quota-stats', days),

  clearAllCache: () => ipcRenderer.invoke('clear-all-cache'),

  searchSessions: (query, limit, offset) =>
    ipcRenderer.invoke('search-sessions', { query, limit, offset }),
  loadSessionsPaginated: (limit, offset, filters) =>
    ipcRenderer.invoke('load-sessions-paginated', { limit, offset, filters }),
  getSessionCount: (filters) => ipcRenderer.invoke('get-session-count', filters),
  getAvailableProjects: (filters) => ipcRenderer.invoke('get-available-projects', filters),

  bulkAnalyzeSessions: (sessionIds, bypassQuota) =>
    ipcRenderer.invoke('bulk-analyze-sessions', sessionIds, bypassQuota),
  cancelBulkAnalyze: () => ipcRenderer.invoke('cancel-bulk-analyze'),
  onBulkAnalyzeProgress: (callback) => {
    ipcRenderer.on('bulk-analyze-progress', callback);
    return () => ipcRenderer.removeListener('bulk-analyze-progress', callback);
  },
  onBulkAnalyzeComplete: (callback) => {
    ipcRenderer.on('bulk-analyze-complete', callback);
    return () => ipcRenderer.removeListener('bulk-analyze-complete', callback);
  },

  openSessionsTmux4: (sessionIds) => ipcRenderer.invoke('open-sessions-tmux4', sessionIds),

  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getTerminalSettings: () => ipcRenderer.invoke('get-terminal-settings'),
  checkTerminalAvailable: (terminal) => ipcRenderer.invoke('check-terminal-available', terminal),

  validatePath: (inputPath) => ipcRenderer.invoke('validate-path', inputPath),
  browseDirectory: () => ipcRenderer.invoke('browse-directory'),
  onPathWarning: (callback) => {
    ipcRenderer.on('path-warning', callback);
    return () => ipcRenderer.removeListener('path-warning', callback);
  },

  validateBinaryPath: (path) => ipcRenderer.invoke('validate-binary-path', path),
  getMostRecentSession: () => ipcRenderer.invoke('get-most-recent-session'),

  onContinuationDetectionProgress: (callback) => {
    ipcRenderer.on('continuation-detection-progress', callback);
    return () => ipcRenderer.removeListener('continuation-detection-progress', callback);
  },

  onContinuationsDetected: (callback) => {
    ipcRenderer.on('continuations-detected', callback);
    return () => ipcRenderer.removeListener('continuations-detected', callback);
  },

  onContinuationsUpdated: (callback) => {
    ipcRenderer.on('continuations-updated', callback);
    return () => ipcRenderer.removeListener('continuations-updated', callback);
  },

  resolveContinuationChains: () => ipcRenderer.invoke('resolve-continuation-chains'),
  getContinuationGroup: (sessionId) => ipcRenderer.invoke('get-continuation-group', sessionId),

  getContinuationChain: (sessionId) => ipcRenderer.invoke('get-continuation-chain', sessionId),
  getContinuationChildren: (sessionId) =>
    ipcRenderer.invoke('get-continuation-children', sessionId),
  getSessionWithContinuations: (sessionId, loadFullMessages) =>
    ipcRenderer.invoke('get-session-with-continuations', sessionId, loadFullMessages),
  getContinuationMetadata: (sessionId) =>
    ipcRenderer.invoke('get-continuation-metadata', sessionId),
  getContinuationStats: () => ipcRenderer.invoke('get-continuation-stats'),

  removeAllListeners: () => ipcRenderer.removeAllListeners(),
});
