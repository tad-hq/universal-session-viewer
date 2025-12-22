/**
 * App Settings Module
 *
 * Extracted from: main.js.backup-20251215 lines 1136-1376
 *
 * V1 Pattern Preservation:
 * - Default settings with nested objects (paths, claudeCode)
 * - Type-aware storage (string, number, boolean, json)
 * - Dot notation for nested keys ('claudeCode.model')
 * - In-memory caching with database persistence
 *
 * Edge Cases Preserved:
 * - Nested key support (claudeCode.model)
 * - Type preservation across serialization
 * - Graceful fallback to defaults if DB fails
 */

const path = require('path');
const os = require('os');
const { safeLog } = require('../config');

/**
 * Get default application settings
 *
 * V1 Pattern (lines 1136-1174):
 * - Includes all default values for app configuration
 * - Uses os.homedir() for path defaults (portable)
 * - Nested objects for claudeCode settings
 *
 * @returns {Object} - Default settings object
 */
function getDefaultSettings() {
  return {
    // Analysis Settings
    dailyAnalysisLimit: 20,
    autoAnalyzeNewSessions: false,
    cacheDurationDays: 30,

    // UI Settings
    showSessionTimestamps: true,
    showProjectPaths: true,
    defaultSortOrder: 'modified',

    // Advanced Settings
    maxConcurrentAnalyses: 1,
    analysisTimeout: 600000, // 10 minutes in ms
    enableDebugLogging: false,

    // Path Settings (Per Implementation Plan: Section 2.3.1)
    // Use tilde notation for portability - expanded at runtime by expandPath()
    paths: {
      claudeProjects: path.join(os.homedir(), '.claude', 'projects'),
      sessionViewerData: path.join(os.homedir(), '.universal-session-viewer'),
      promptsDirectory: path.join(os.homedir(), '.claude', 'prompts'),
      additionalDiscoveryPaths: [],
      excludePaths: [],
    },

    // Claude Code Settings (nested JSON object)
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

/**
 * Load all settings from database
 *
 * V1 Pattern (lines 1279-1320):
 * - Query app_settings table
 * - Parse values based on value_type
 * - Merge with defaults (defaults first, then overrides)
 * - Fallback to defaults if DB fails
 *
 * @param {Database} db - SQLite database instance
 * @returns {Object} - Merged settings object
 */
function loadSettings(db) {
  if (!db) {
    safeLog.log('Using default settings (no database)');
    return getDefaultSettings();
  }

  try {
    const stmt = db.prepare('SELECT key, value, value_type FROM app_settings');
    const rows = stmt.all();

    // Start with defaults
    const settings = getDefaultSettings();

    // Override with stored values
    rows.forEach((row) => {
      let parsedValue;
      switch (row.value_type) {
        case 'number':
          parsedValue = Number(row.value);
          break;
        case 'boolean':
          parsedValue = row.value === 'true';
          break;
        case 'string':
          parsedValue = row.value;
          break;
        case 'json':
          parsedValue = JSON.parse(row.value);
          break;
        default:
          parsedValue = row.value;
      }
      settings[row.key] = parsedValue;
    });

    safeLog.log('Settings loaded from database');
    return settings;
  } catch (error) {
    safeLog.error('Error loading settings:', error);
    return getDefaultSettings();
  }
}

/**
 * Get a single setting value with dot notation support
 *
 * V1 Pattern (lines 1262-1277):
 * - Supports nested keys like 'claudeCode.model'
 * - Returns defaultValue if key not found
 * - Handles undefined gracefully
 *
 * @param {Object} settings - Settings object (from loadSettings)
 * @param {string} key - Setting key (supports dot notation)
 * @param {*} defaultValue - Default value if not found
 * @returns {*} - The setting value or default
 */
function getSetting(settings, key, defaultValue = undefined) {
  if (!settings) {
    return defaultValue;
  }

  // Handle nested keys like 'claudeCode.model'
  const keys = key.split('.');
  let value = settings;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return defaultValue;
    }
  }
  return value !== undefined ? value : defaultValue;
}

/**
 * Save a single setting to database
 *
 * V1 Pattern (lines 1322-1339):
 * - Determine value type (string, number, boolean, json)
 * - Serialize to string with type metadata
 * - INSERT OR REPLACE (upsert pattern)
 *
 * @param {Database} db - SQLite database instance
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 */
function saveSetting(db, key, value) {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Determine value type
  const valueType = typeof value === 'object' ? 'json' : typeof value;
  const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);

  // INSERT OR REPLACE
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO app_settings (key, value, value_type, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);
  stmt.run(key, valueStr, valueType);

  safeLog.log(`Setting saved: ${key} = ${valueStr}`);
}

/**
 * Save all settings to database (bulk save)
 *
 * V1 Pattern (lines 1341-1362):
 * - Use transaction for atomic bulk save
 * - Iterate over settings object
 * - Serialize each value with type metadata
 *
 * @param {Database} db - SQLite database instance
 * @param {Object} settings - Settings object to save
 */
function saveAllSettings(db, settings) {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // Transaction for bulk save
  const saveStmt = db.prepare(`
    INSERT OR REPLACE INTO app_settings (key, value, value_type, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);

  db.transaction(() => {
    Object.entries(settings).forEach(([key, value]) => {
      const valueType = typeof value === 'object' ? 'json' : typeof value;
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      saveStmt.run(key, valueStr, valueType);
    });
  })();

  safeLog.log('All settings saved to database');
}

module.exports = {
  getDefaultSettings,
  loadSettings,
  getSetting,
  saveSetting,
  saveAllSettings,
};
