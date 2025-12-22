const path = require('path');
const os = require('os');

function getDefaultSettings() {
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

    paths: {
      claudeProjects: path.join(os.homedir(), '.claude', 'projects'),
      sessionViewerData: path.join(os.homedir(), '.universal-session-viewer'),
      promptsDirectory: path.join(os.homedir(), '.claude', 'prompts'),
      additionalDiscoveryPaths: [],
      excludePaths: [],
    },

    claudeCode: {
      binaryPath: 'claude',
      dangerouslySkipPermissions: false,
      model: 'claude-haiku-4-5-20251001',
      permissionMode: 'default',
      appendSystemPrompt: '',
      maxTurns: 0,
      autoResume: false,
    },
  };
}

function getTodayDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function fallbackPathResolution(projectName) {
  let basePath = '';
  let displayName = projectName;

  if (projectName.startsWith('-Users-')) {
    displayName = projectName.replace(/^-Users-/, '');
    basePath = '/Users';
  } else if (projectName.startsWith('-private-')) {
    displayName = projectName.replace(/^-private-/, '');
    basePath = '/private';
  } else {
    return projectName.replace(/-/g, '/');
  }

  const parts = displayName.split('-').filter((p) => p);

  return path.join(basePath, ...parts);
}

module.exports = { getDefaultSettings, getTodayDateString, fallbackPathResolution };
