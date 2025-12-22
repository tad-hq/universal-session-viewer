/**
 * Terminal Configuration Module
 *
 * Extracted from: main.js.backup-20251215 lines 92-225
 * Contains: Terminal launch command templates, settings, launcher functions
 *
 * V1 Pattern Context:
 * - Platform-specific terminal detection and launching
 * - Custom terminal command support
 * - Ghostty special handling (macOS uses 'open -a', Linux uses '-e' flag)
 *
 * V1 Edge Case Preservation (backup lines 92-225):
 * - Ghostty on macOS requires 'open -a' (CLI launching limited)
 * - Ghostty on Linux uses '-e' flag for command execution
 * - Terminal availability checking via 'which' command
 * - Custom terminal command with {cmd} placeholder replacement
 */

const fs = require('fs');
const { spawn } = require('child_process');
const { safeLog } = require('./index');

/**
 * Terminal launch command templates (per V1 specification)
 * V1 Pattern: Lines 101-146 from backup
 *
 * NOTE: Ghostty on Linux uses -e flag for executing commands
 * See: https://man.archlinux.org/man/ghostty.1
 * macOS Ghostty must be launched via 'open -a' since CLI launching is not fully supported
 */
const TERMINAL_LAUNCH_COMMANDS = {
  // macOS default
  'Terminal.app': {
    direct: (scriptPath) => ['open', ['-a', 'Terminal.app', scriptPath]],
    available: () => process.platform === 'darwin',
  },

  // Linux default
  'gnome-terminal': {
    direct: (scriptPath) => ['gnome-terminal', ['--', 'bash', scriptPath]],
    available: () => {
      try {
        require('child_process').execSync('which gnome-terminal', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    },
  },

  // Ghostty (macOS/Linux)
  // On macOS: Must use 'open -a Ghostty' as CLI launching is limited
  // On Linux: Use 'ghostty -e bash <script>' to execute the script
  Ghostty: {
    direct: (scriptPath) => {
      if (process.platform === 'darwin') {
        // macOS: Launch via 'open -a' - Ghostty will execute the script
        return ['open', ['-a', 'Ghostty', scriptPath]];
      }
      // Linux: Use -e flag to execute bash with the script
      // Note: Ghostty -e takes the command directly, not a shell wrapper
      return ['ghostty', ['-e', 'bash', scriptPath]];
    },
    available: () => {
      try {
        if (process.platform === 'darwin') {
          return fs.existsSync('/Applications/Ghostty.app');
        }
        require('child_process').execSync('which ghostty', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    },
  },
};

/**
 * Get terminal settings from database with defaults
 * V1 Pattern: Lines 148-170 from backup
 *
 * @param {Database} db - SQLite database instance
 * @returns {Object} Terminal settings with defaults
 */
function getTerminalSettings(db) {
  const DEFAULT_TERMINAL = {
    application: process.platform === 'darwin' ? 'Terminal.app' : 'gnome-terminal',
    useTmux: false,
    tmuxSessionPrefix: 'claude-',
    customLaunchCommand: undefined,
  };

  if (!db) return DEFAULT_TERMINAL;

  try {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('terminal');
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      return { ...DEFAULT_TERMINAL, ...parsed };
    }
  } catch (error) {
    safeLog.error('Error reading terminal settings:', error);
  }

  return DEFAULT_TERMINAL;
}

/**
 * Launch terminal with the given script
 * V1 Pattern: Lines 172-221 from backup
 *
 * V1 Edge Cases Preserved:
 * - Custom terminal command with {cmd} placeholder (line 186)
 * - Terminal availability checking before launch (line 196)
 * - Error handling for missing/unavailable terminals
 *
 * @param {string} scriptPath - Path to bash script to execute
 * @param {Object} terminalSettings - Terminal configuration
 * @returns {Promise<{success: boolean}>} Resolution when terminal launches
 */
function launchTerminal(scriptPath, terminalSettings) {
  return new Promise((resolve, reject) => {
    let cmd, args;

    if (terminalSettings.application === 'custom') {
      // Custom command with {cmd} placeholder
      if (!terminalSettings.customLaunchCommand) {
        return reject(new Error('Custom terminal selected but no command configured'));
      }

      // Replace {cmd} with the script path
      // V1 Edge Case: Custom command template (line 186)
      const fullCmd = terminalSettings.customLaunchCommand.replace('{cmd}', `bash "${scriptPath}"`);
      // Execute via shell
      cmd = '/bin/sh';
      args = ['-c', fullCmd];
    } else {
      const launcher = TERMINAL_LAUNCH_COMMANDS[terminalSettings.application];
      if (!launcher) {
        return reject(new Error(`Unknown terminal: ${terminalSettings.application}`));
      }

      // V1 Edge Case: Check terminal availability before launching (line 196)
      if (!launcher.available()) {
        return reject(
          new Error(`Terminal ${terminalSettings.application} is not available on this system`)
        );
      }

      [cmd, args] = launcher.direct(scriptPath);
    }

    safeLog.log(`Launching terminal: ${cmd} ${args.join(' ')}`);

    const terminal = spawn(cmd, args);

    terminal.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`Terminal exited with code ${code}`));
      }
    });

    terminal.on('error', (error) => {
      reject(error);
    });
  });
}

module.exports = {
  TERMINAL_LAUNCH_COMMANDS,
  getTerminalSettings,
  launchTerminal,
};
