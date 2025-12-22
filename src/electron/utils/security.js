const path = require('path');
const os = require('os');

function expandPath(inputPath) {
  if (!inputPath) return inputPath;

  let expanded = inputPath;

  if (expanded === '~') {
    expanded = os.homedir();
  } else if (expanded.startsWith('~/')) {
    expanded = path.join(os.homedir(), expanded.slice(2));
  }

  expanded = expanded.replace(/\$\{?(\w+)\}?/g, (match, varName) => {
    return process.env[varName] || match;
  });

  const normalized = path.normalize(expanded);

  const allowedBases = [
    os.homedir(),
    path.join(os.homedir(), '.claude'),
    path.join(os.homedir(), '.universal-session-viewer'),
    path.join(os.homedir(), '.claude-m'),
    '/tmp',
    '/var/tmp',
  ];

  const isWithinAllowedBase = allowedBases.some((base) => {
    const relative = path.relative(base, normalized);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  });

  if (!isWithinAllowedBase) {
    throw new Error('Path traversal detected: path must be within allowed directories');
  }

  return normalized;
}

function validateSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Session ID must be a non-empty string');
  }

  const validPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validPattern.test(sessionId)) {
    throw new Error(
      'Invalid session ID format: must contain only alphanumeric characters, hyphens, and underscores'
    );
  }

  if (sessionId.length > 200) {
    throw new Error('Session ID exceeds maximum length');
  }

  return true;
}

function escapeForShell(str) {
  if (!str) return "''";
  // Proper shell escaping: wrap in single quotes and escape any single quotes inside
  // In bash, 'text' treats everything as literal except single quotes
  // To include a single quote: end the quoted string, add escaped quote, resume quoted string
  // Example: 'it'\''s' produces: it's
  return "'" + str.replace(/'/g, "'\"'\"'") + "'";
}

module.exports = { expandPath, validateSessionId, escapeForShell };
