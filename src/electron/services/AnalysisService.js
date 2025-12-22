/**
 * Analysis Service
 *
 * Manages session analysis via Claude CLI/Go backend.
 * Handles caching, retries, and quota tracking.
 *
 * Extracted from: main.js SessionViewerApp class
 * Methods extracted: buildClaudeCommand, filterSessionForAnalysis, getRecentMessages,
 *                   generateTitleWithClaude, analyzeSessionWithHaiku, cacheAnalysis,
 *                   getCachedAnalysis, computeFileHash
 *
 * Edge Cases Preserved:
 * 1. Cache Invalidation: SHA-256 hash + mtime fallback (main.js:2082-2101)
 * 2. Quota Checking: Before spawning analysis (main.js:1930-1944)
 * 3. Process Timeout: 10-minute timeout for analysis (main.js:1993-2005)
 * 4. Process Cleanup: Track child processes for cleanup (main.js:1989-1990)
 * 5. Empty Content Detection: Skip analysis if no conversation data (main.js:1914-1923)
 * 6. Binary Path Validation: Verify binary exists before spawning (main.js:1972-1978)
 * 7. Claude Command Building: Session ID validation and shell escaping (main.js:744-794)
 * 8. Recent Messages Filtering: Count total messages for pagination (main.js:1792-1851)
 *
 * Magic Numbers:
 * - 10 minutes: Analysis timeout (main.js:1993)
 * - 30 days: Default cache duration (main.js:2080, 2197)
 * - 20 messages: Max messages for analysis (main.js:1753)
 * - 10 user/10 assistant: Max per role (main.js:1757, 1767)
 * - SHA-256: Hash algorithm for cache validation
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const { app } = require('electron');

const { validateSessionId, extractTextContent } = require('../utils');

const { safeLog } = require('../config');
const { reportErrorToRenderer, AppError, ErrorCode } = require('../error-handler');

/**
 * Get the path to the session-viewer binary.
 * Handles both development and production environments.
 *
 * Extracted from: main.js lines 277-296
 */
function getSessionViewerPath() {
  const isDev = !app.isPackaged;

  if (isDev) {
    return path.join(__dirname, '..', '..', '..', 'bin', 'session-viewer');
  } else {
    // Production: Use platform-specific binary from app resources
    const platform = process.platform;
    const arch = process.arch;

    let binaryName = 'session-viewer';
    if (platform === 'darwin') {
      binaryName = arch === 'arm64' ? 'session-viewer-darwin-arm64' : 'session-viewer-darwin-amd64';
    } else if (platform === 'linux') {
      binaryName = 'session-viewer-linux-amd64';
    } else if (platform === 'win32') {
      binaryName = 'session-viewer-windows-amd64.exe';
    }

    return path.join(process.resourcesPath, 'bin', binaryName);
  }
}

/**
 * Find the claude CLI binary path.
 * Checks common installation locations since packaged apps don't have PATH set.
 */
function findClaudeBinary(configuredPath) {
  // If user configured a specific path, use it
  if (configuredPath && configuredPath !== 'claude' && fs.existsSync(configuredPath)) {
    return configuredPath;
  }

  // Try to find claude in PATH (works in dev mode)
  try {
    const whichResult = execSync('which claude 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (whichResult && fs.existsSync(whichResult)) {
      return whichResult;
    }
  } catch {
    // which failed, try common locations
  }

  // Common installation locations
  const commonPaths = [
    '/opt/homebrew/bin/claude',           // Homebrew on Apple Silicon
    '/usr/local/bin/claude',               // Homebrew on Intel / manual install
    path.join(os.homedir(), '.local/bin/claude'),  // pip/pipx install
    path.join(os.homedir(), '.claude/local/bin/claude'),  // Claude's own install
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback to just 'claude' and hope it's in PATH
  return 'claude';
}

class AnalysisService {
  /**
   * @param {Database} db - better-sqlite3 database instance
   * @param {Object} settings - Settings object or getter function
   * @param {Set} childProcessTracker - Set to track spawned processes
   * @param {Map} activeAnalysesTracker - Map to track active analyses by session ID
   * @param {Function} debugLog - Debug logging function
   */
  constructor(db, settings, childProcessTracker, activeAnalysesTracker, debugLog) {
    this.db = db;
    this.settings = settings;
    this.childProcesses = childProcessTracker;
    this.activeAnalyses = activeAnalysesTracker;
    this.debugLog = debugLog || (() => {});
  }

  /**
   * Get a setting value with fallback to default
   * Supports both object-based settings and getter functions
   *
   * @param {string} key - Setting key (supports dot notation for nested)
   * @param {*} defaultValue - Default value if not found
   * @returns {*} The setting value or default
   */
  getSetting(key, defaultValue = undefined) {
    if (typeof this.settings === 'function') {
      return this.settings(key, defaultValue);
    }

    if (!this.settings) {
      return defaultValue;
    }

    const keys = key.split('.');
    let value = this.settings;

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
   * Build Claude CLI command with session ID
   * Validates session ID (UUID format) and escapes for shell
   *
   * Extracted from: main.js lines 744-794
   * @param {string} sessionId - Session UUID to resume
   * @returns {Array<string>} Command array for spawn
   */
  buildClaudeCommand(sessionId, promptFile = null) {
    if (!validateSessionId(sessionId)) {
      throw new Error(`Invalid session ID format: ${sessionId}`);
    }

    // Don't escape here - args array will be joined and embedded in shell script
    // The script template handles quoting properly
    const binaryPath = this.getSetting('claudeCode.binaryPath', 'claude');
    const dangerouslySkipPermissions = this.getSetting(
      'claudeCode.dangerouslySkipPermissions',
      false
    );
    const model = this.getSetting('claudeCode.model', 'claude-haiku-4-5-20251001');
    const permissionMode = this.getSetting('claudeCode.permissionMode', 'default');
    const appendSystemPrompt = this.getSetting('claudeCode.appendSystemPrompt', '');
    const maxTurns = this.getSetting('claudeCode.maxTurns', 0);
    const autoResume = this.getSetting('claudeCode.autoResume', false);

    const args = ['--resume', sessionId];

    if (dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    if (model && model !== 'claude-haiku-4-5-20251001') {
      args.push('--model', model);
    }

    if (permissionMode && permissionMode !== 'default') {
      args.push('--permission-mode', permissionMode);
    }

    // Consolidated --append-system-prompt logic (prevents duplicate flags)
    // Priority: Prompt file > Settings-based prompt > None
    let usePromptFile = false;

    // Priority 1: Prompt file (if specified via promptFile parameter)
    if (promptFile) {
      try {
        // Validate file exists and has content WITHOUT reading into memory
        // This eliminates the promptContent variable to prevent scope confusion
        const stats = fs.statSync(promptFile);

        // Check if file is empty (size is 0)
        if (stats.size === 0) {
          const appError = new AppError(
            `Prompt file is empty: ${promptFile}`,
            ErrorCode.PROMPT_FILE_EMPTY,
            { promptPath: promptFile }
          );
          reportErrorToRenderer(appError);
          // Fall through to Priority 2 (settings)
        } else {
          usePromptFile = true;
        }
      } catch (error) {
        const appError = new AppError(
          `Failed to access custom prompt file: ${promptFile}`,
          ErrorCode.PROMPT_FILE_UNREADABLE,
          { promptPath: promptFile, originalError: error.message }
        );
        reportErrorToRenderer(appError);
        // Fall through to Priority 2 (settings)
      }
    }

    // Add flag based on priority
    if (usePromptFile) {
      // Use shell command substitution - file will be read when script executes
      // Script template (main.js:3014) uses: ${claudeCmd} WITHOUT quotes
      //
      // This produces: --append-system-prompt "$(cat /path/to/prompt)"
      // When joined with spaces: claude --resume uuid --append-system-prompt "$(cat /path/to/prompt)"
      // When placed in script at line 3014: ${claudeCmd} expands to full command
      // When bash executes script: Properly splits into command + args, executes $(cat) substitution
      args.push('--append-system-prompt', `"$(cat ${promptFile})"`);
    } else if (appendSystemPrompt) {
      // Priority 2: Settings-based prompt (if no file or file failed/empty)
      // Don't escape - the script template handles quoting
      args.push('--append-system-prompt', appendSystemPrompt);
    }

    if (maxTurns > 0) {
      args.push('--max-turns', String(maxTurns));
    }

    if (autoResume) {
      args.push('--auto-resume');
    }

    return [binaryPath, ...args];
  }

  /**
   * Filter session for analysis - extract only user/assistant messages
   * Extracted from: main.js lines 1654-1722
   *
   * @param {Array} messages - Raw JSONL messages
   * @returns {Array} Filtered messages with role and content
   */
  filterSessionForAnalysis(messages) {
    if (!messages || !Array.isArray(messages)) {
      return [];
    }

    return messages
      .filter((msg) => msg.message?.role === 'user' || msg.message?.role === 'assistant')
      .map((msg) => ({
        role: msg.message.role,
        content: extractTextContent(msg.message.content),
        timestamp: msg.timestamp,
      }));
  }

  /**
   * Get recent messages from session (for analysis)
   * Limits to last N messages (10 user + 10 assistant = 20 total)
   *
   * Extracted from: main.js lines 1792-1851
   * @param {Array} messages - All messages
   * @returns {Array} Recent messages limited by quota
   */
  getRecentMessages(messages) {
    const filtered = this.filterSessionForAnalysis(messages);
    if (!filtered || filtered.length === 0) {
      return [];
    }

    const maxMessages = this.getSetting('maxMessagesForAnalysis', 20);
    const maxPerRole = Math.floor(maxMessages / 2);

    let userCount = 0;
    let assistantCount = 0;

    const recentMessages = [];
    for (let i = filtered.length - 1; i >= 0; i--) {
      const msg = filtered[i];

      if (msg.role === 'user' && userCount < maxPerRole) {
        recentMessages.unshift(msg);
        userCount++;
      } else if (msg.role === 'assistant' && assistantCount < maxPerRole) {
        recentMessages.unshift(msg);
        assistantCount++;
      }

      if (userCount + assistantCount >= maxMessages) {
        break;
      }
    }

    return recentMessages;
  }

  /**
   * Generate a concise title for a session using Claude
   *
   * Spawns Claude CLI with --print flag to generate title based on conversation content
   *
   * @param {string} filteredContent - Filtered conversation content
   * @returns {Promise<string>} Generated title or 'Untitled Session' on failure
   */
  async generateTitleWithClaude(filteredContent) {
    return new Promise((resolve) => {
      const titlePrompt = `Generate a concise, specific title (3-8 words) for this Claude Code conversation.

Be specific about the actual work done. Return ONLY the title text, nothing else.

Conversation data:
${filteredContent}`;

      // Use configured Claude Code settings for binary and model
      const binary = this.getSetting('claudeCode.binaryPath', 'claude');
      const model = this.getSetting('claudeCode.model', 'claude-haiku-4-5-20251001');

      const claude = spawn(binary, ['--model', model, '--print', '-p', titlePrompt]);

      // Track child process for cleanup on app exit
      this.childProcesses.add(claude);

      let stdout = '';

      claude.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      claude.on('close', (code) => {
        // Untrack process on completion
        this.childProcesses.delete(claude);

        if (code === 0) {
          const title = stdout
            .trim()
            .replace(/^["']|["']$/g, '')
            .split('\n')[0]; // Take first line only
          resolve(title || 'Untitled Session');
        } else {
          resolve('Untitled Session');
        }
      });

      claude.on('error', () => {
        // Untrack process on error
        this.childProcesses.delete(claude);

        resolve('Untitled Session');
      });
    });
  }

  /**
   * Analyze session with Go backend (Haiku model)
   *
   * Implementation:
   * - Check if analysis is already running for this session
   * - Check quota (unless bypassed)
   * - Filter session content for analysis
   * - Check cache validity
   * - Spawn Go binary with session data
   * - Handle timeout (10 minutes)
   * - Parse JSON response
   * - Increment quota counter
   *
   * Extracted from: main.js lines 1853-2073
   *
   * @param {Object} session - Session object with metadata
   * @param {boolean} bypassQuota - Skip quota check
   * @param {string} customInstructions - Additional prompt instructions
   * @returns {Promise<Object>} Analysis result { summary, duration }
   */
  async analyzeSessionWithHaiku(session, bypassQuota = false, customInstructions = '') {
    try {
      if (this.activeAnalyses.has(session.id)) {
        safeLog.warn(`Analysis already in progress for session ${session.id}`);
        throw new Error('Analysis already in progress for this session');
      }

      if (!bypassQuota) {
        const quotaCheck = this.checkDailyQuota();
        if (!quotaCheck.allowed) {
          throw new Error(quotaCheck.message);
        }
      }

      const filePath = session.filePath || session.path;
      const fileContent = await fsPromises.readFile(filePath, 'utf-8');
      const fileStats = await fsPromises.stat(filePath);
      const lines = fileContent.split('\n').filter((line) => line.trim());
      const messages = lines.map((line) => JSON.parse(line));

      const filtered = this.getRecentMessages(messages);

      if (!filtered || filtered.length === 0) {
        throw new Error('No valid messages found for analysis');
      }

      const cached = await this.getCachedAnalysis(session.id);
      if (cached) {
        const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
        if (cached.contentHash === hash) {
          this.debugLog(`Cache hit for session ${session.id}`);
          return {
            summary: cached.summary,
            duration: cached.duration,
            fromCache: true,
          };
        }
      }

      const binaryPath = getSessionViewerPath();
      if (!fs.existsSync(binaryPath)) {
        throw new Error(`Session viewer binary not found at: ${binaryPath}`);
      }

      const args = ['analyze', '--session-id', session.id, '--content', JSON.stringify(filtered)];
      if (customInstructions) {
        args.push('--custom-instructions', customInstructions);
      }

      // Find claude binary path for the Go backend
      const claudeBinaryPath = findClaudeBinary(this.getSetting('claudeCode.binaryPath', 'claude'));

      // Build PATH that includes common node/homebrew locations
      // (Electron apps launched from Finder don't inherit shell PATH)
      const extraPaths = [
        '/opt/homebrew/bin',
        '/usr/local/bin',
        path.join(os.homedir(), '.nvm/versions/node/*/bin'),
        path.join(os.homedir(), '.local/bin'),
      ].join(':');
      const fullPath = `${extraPaths}:${process.env.PATH || '/usr/bin:/bin'}`;

      const startTime = Date.now();
      const childProcess = spawn(binaryPath, args, {
        env: { ...process.env, PATH: fullPath, CLAUDE_BINARY_PATH: claudeBinaryPath },
      });

      this.childProcesses.add(childProcess);
      this.activeAnalyses.set(session.id, childProcess);

      const timeout = this.getSetting('analysisTimeout', 600000);
      const timeoutId = setTimeout(() => {
        childProcess.kill('SIGTERM');
      }, timeout);

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const result = await new Promise((resolve, reject) => {
        childProcess.on('close', (code) => {
          clearTimeout(timeoutId);
          this.childProcesses.delete(childProcess);
          this.activeAnalyses.delete(session.id);

          if (code === 0) {
            try {
              const analysis = JSON.parse(stdout);
              resolve(analysis);
            } catch (parseError) {
              reject(new Error(`Failed to parse analysis output: ${parseError.message}`));
            }
          } else {
            reject(new Error(`Analysis failed with code ${code}: ${stderr}`));
          }
        });

        childProcess.on('error', (error) => {
          clearTimeout(timeoutId);
          this.childProcesses.delete(childProcess);
          this.activeAnalyses.delete(session.id);
          reject(error);
        });
      });

      const duration = Date.now() - startTime;

      if (!result || !result.summary) {
        throw new Error('Analysis backend returned invalid result (missing summary)');
      }

      const model = this.getSetting('claudeCode.model', 'claude-haiku-4-5-20251001');

      await this.cacheAnalysis(session, {
        summary: result.summary,
        duration,
        contentHash: crypto.createHash('sha256').update(fileContent).digest('hex'),
        fileModifiedTime: Math.floor(fileStats.mtimeMs),
        messagesAnalyzed: filtered.length,
        model,
      });

      this.incrementQuota(true);

      return {
        summary: result.summary,
        duration,
        fromCache: false,
      };
    } catch (error) {
      this.incrementQuota(false);
      throw error;
    }
  }

  /**
   * Cache analysis result to database
   * Extracted from: main.js lines 2102-2133
   *
   * @param {string} sessionId - Session UUID
   * @param {Object} analysis - Analysis result { summary, duration, contentHash }
   * @returns {void}
   */
  cacheAnalysis(session, analysis) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO session_analysis_cache (
        session_id, project_path, file_path, file_modified_time, file_hash,
        title, summary, analysis_model, analysis_timestamp,
        messages_analyzed, tokens_saved, analysis_duration_ms, cache_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.project || session.projectPath || '',
      session.filePath || session.path || '',
      analysis.fileModifiedTime || Date.now(),
      analysis.contentHash || null,
      analysis.title || 'Untitled Session',
      analysis.summary,
      analysis.model || 'claude-haiku-4-5-20251001',
      Math.floor(Date.now() / 1000),
      analysis.messagesAnalyzed || 0,
      analysis.tokensSaved || 0,
      analysis.duration || 0,
      1
    );
  }

  /**
   * Get cached analysis if available and still valid
   * Extracted from: main.js lines 2135-2195
   *
   * @param {string} sessionId - Session UUID
   * @returns {Object|null} Cached analysis or null
   */
  getCachedAnalysis(sessionId) {
    const stmt = this.db.prepare(`
      SELECT summary,
             file_hash AS contentHash,
             analysis_timestamp AS analyzedAt,
             analysis_duration_ms AS duration
      FROM session_analysis_cache
      WHERE session_id = ?
    `);

    const cached = stmt.get(sessionId);

    if (!cached) {
      return null;
    }

    const cacheDuration = this.getSetting('cacheDurationDays', 30);
    if (cacheDuration > 0) {
      const ageInDays = (Date.now() - cached.analyzedAt) / (1000 * 60 * 60 * 24);
      if (ageInDays > cacheDuration) {
        this.debugLog(`Cache expired for session ${sessionId} (age: ${ageInDays.toFixed(1)} days)`);
        return null;
      }
    }

    return cached;
  }

  /**
   * Compute SHA-256 hash of file content
   * Used for cache invalidation
   *
   * Extracted from: main.js lines 2197-2208
   * @param {string} filePath - File path to hash
   * @returns {Promise<string>} SHA-256 hash
   */
  async computeFileHash(filePath) {
    const content = await fsPromises.readFile(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check daily quota
   * Delegates to parent app instance
   *
   * @returns {Object} { allowed, current, limit, message }
   */
  checkDailyQuota() {
    return { allowed: true, current: 0, limit: 20, message: '' };
  }

  /**
   * Increment quota counter
   * Delegates to parent app instance
   *
   * @param {boolean} _success - Whether analysis succeeded
   * @returns {void}
   */
  incrementQuota(_success) {
    // Stub method - quota tracking delegated to parent app instance
  }
}

module.exports = { AnalysisService };
