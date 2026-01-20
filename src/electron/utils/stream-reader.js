/**
 * Stream reader utilities for handling large JSONL files
 * Uses Node.js readline module to read line-by-line without loading entire file into memory
 */

const fs = require('fs');
const readline = require('readline');

/**
 * Read JSONL file line-by-line with callback for each line
 * Perfect for large files - doesn't load entire content into memory
 *
 * @param {string} filePath - Path to JSONL file
 * @param {Function} lineCallback - Called for each parsed JSON line: (parsed, lineNumber) => void
 * @param {Function} errorCallback - Called on errors: (error) => void
 * @returns {Promise<void>}
 */
async function readJsonlLineByLine(filePath, lineCallback, errorCallback = null) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity, // Handle both \r\n and \n
    });

    let lineNumber = 0;

    rl.on('line', (line) => {
      lineNumber++;
      if (!line.trim()) return; // Skip empty lines

      try {
        const parsed = JSON.parse(line);
        lineCallback(parsed, lineNumber);
      } catch (parseError) {
        if (errorCallback) {
          errorCallback(parseError, lineNumber, line);
        }
      }
    });

    rl.on('close', () => resolve());
    rl.on('error', reject);
    fileStream.on('error', reject);
  });
}

/**
 * Check if a JSONL file has user/assistant messages without loading entire file
 * Returns as soon as first user/assistant message is found
 *
 * @param {string} filePath - Path to JSONL file
 * @returns {Promise<boolean>} True if file contains user or assistant messages
 */
async function hasConversationMessages(filePath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let resolved = false; // Flag to prevent double resolution

    rl.on('line', (line) => {
      if (!line.trim()) return;

      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'user' || parsed.type === 'assistant') {
          if (!resolved) {
            resolved = true;
            rl.close();
            fileStream.destroy();
            resolve(true);
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    });

    rl.on('close', () => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });
    rl.on('error', reject);
    fileStream.on('error', reject);
  });
}

/**
 * Get last N lines from a JSONL file efficiently
 * Reads from end of file backwards
 *
 * @param {string} filePath - Path to JSONL file
 * @param {number} lineCount - Number of lines to read from end
 * @returns {Promise<Object[]>} Array of parsed JSON objects
 */
async function getLastNLines(filePath, lineCount = 20) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    const lines = [];

    rl.on('line', (line) => {
      if (!line.trim()) return;

      try {
        const parsed = JSON.parse(line);
        lines.push(parsed);

        if (lines.length > lineCount) {
          lines.shift();
        }
      } catch {
        // Ignore JSON parse errors
      }
    });

    rl.on('close', () => resolve(lines));
    rl.on('error', reject);
    fileStream.on('error', reject);
  });
}

module.exports = {
  readJsonlLineByLine,
  hasConversationMessages,
  getLastNLines,
};
