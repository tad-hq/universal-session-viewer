/**
 * Integration test for resume session with prompt file
 * Tests the complete flow from buildClaudeCommand to script generation
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { expect } = require('chai');

describe('Prompt File Resume Integration', () => {
  let testPromptFile;
  let testPromptContent;
  let AnalysisService;
  let buildClaudeCommand;

  before(() => {
    // Create test prompt file
    const tmpDir = os.tmpdir();
    testPromptFile = path.join(tmpDir, 'test-prompt.md');
    testPromptContent = '# Test Prompt\n\nThis is a test system prompt with special characters: $VAR, `command`, and "quotes".\n';
    fs.writeFileSync(testPromptFile, testPromptContent);

    // Load AnalysisService
    const AnalysisServiceClass = require('../../src/electron/services/AnalysisService.js');
    AnalysisService = new AnalysisServiceClass();
    buildClaudeCommand = AnalysisService.buildClaudeCommand.bind(AnalysisService);
  });

  after(() => {
    // Cleanup test file
    if (fs.existsSync(testPromptFile)) {
      fs.unlinkSync(testPromptFile);
    }
  });

  describe('buildClaudeCommand', () => {
    it('should build command array with prompt file', () => {
      const sessionId = 'test-session-12345';
      const cmdArray = buildClaudeCommand(sessionId, testPromptFile);

      expect(cmdArray).to.be.an('array');
      expect(cmdArray[0]).to.equal('claude'); // binary path
      expect(cmdArray).to.include('--resume');
      expect(cmdArray).to.include(sessionId);
      expect(cmdArray).to.include('--append-system-prompt');
    });

    it('should use shell command substitution syntax', () => {
      const sessionId = 'test-session-12345';
      const cmdArray = buildClaudeCommand(sessionId, testPromptFile);

      // Find the --append-system-prompt argument
      const promptFlagIndex = cmdArray.indexOf('--append-system-prompt');
      expect(promptFlagIndex).to.not.equal(-1);

      const promptValue = cmdArray[promptFlagIndex + 1];

      // Should contain $(cat ...) syntax
      expect(promptValue).to.match(/\$\(cat\s+"[^"]+"\)/);

      // Should contain the file path
      expect(promptValue).to.include(testPromptFile);

      // Should NOT contain escaped content or file content itself
      expect(promptValue).to.not.include(testPromptContent);
    });

    it('should NOT escape session ID with quotes', () => {
      const sessionId = 'test-session-12345';
      const cmdArray = buildClaudeCommand(sessionId, testPromptFile);

      const resumeFlagIndex = cmdArray.indexOf('--resume');
      const sessionIdValue = cmdArray[resumeFlagIndex + 1];

      // Should be raw session ID, not wrapped in quotes
      expect(sessionIdValue).to.equal(sessionId);
      expect(sessionIdValue).to.not.match(/^['"].*['"]$/);
    });
  });

  describe('Script Template Generation', () => {
    it('should generate script with bash -c wrapper', () => {
      const sessionId = 'test-session-12345';
      const cmdArray = buildClaudeCommand(sessionId, testPromptFile);
      const claudeCmd = cmdArray.join(' ');

      // Simulate the script template (simplified)
      const sessionName = `claude-${sessionId}`;
      const scriptContent = `#!/bin/bash
tmux new-session -s "${sessionName}" -- bash -c "${claudeCmd}"
`;

      // Verify bash -c is present
      expect(scriptContent).to.include('bash -c');

      // Verify command substitution is in the script
      expect(scriptContent).to.match(/\$\(cat\s+"[^"]+"\)/);

      // Verify the prompt file path is in the script
      expect(scriptContent).to.include(testPromptFile);
    });

    it('should properly quote the command for bash -c', () => {
      const sessionId = 'test-session-12345';
      const cmdArray = buildClaudeCommand(sessionId, testPromptFile);
      const claudeCmd = cmdArray.join(' ');

      const scriptLine = `tmux new-session -s "session" -- bash -c "${claudeCmd}"`;

      // Count quotes - should be balanced
      const doubleQuotes = (scriptLine.match(/"/g) || []).length;
      expect(doubleQuotes % 2).to.equal(0, 'Quotes should be balanced');

      // Verify the full command structure
      expect(scriptLine).to.match(/tmux new-session -s "[^"]+" -- bash -c ".*"/);
    });
  });

  describe('End-to-End Script Execution', () => {
    it('should execute bash command substitution when script runs', function (done) {
      this.timeout(5000);

      const sessionId = 'test-session-12345';
      const cmdArray = buildClaudeCommand(sessionId, testPromptFile);
      const claudeCmd = cmdArray.join(' ');

      // Create a test script that simulates what the app does
      const testScriptPath = path.join(os.tmpdir(), `test-script-${Date.now()}.sh`);
      const testScriptContent = `#!/bin/bash
# Simulate the command but just echo what would be executed
echo "Would execute: ${claudeCmd}"

# Test that command substitution works by extracting just the $(cat) part
PROMPT_ARG=$(echo "${claudeCmd}" | grep -o '\\$(cat "[^"]*")')
echo "Prompt argument: $PROMPT_ARG"

# Actually execute the command substitution to verify it works
PROMPT_CONTENT=$(eval echo "$PROMPT_ARG")
echo "Prompt content length: \${#PROMPT_CONTENT}"

# Verify content was read (should be non-zero length)
if [ \${#PROMPT_CONTENT} -gt 0 ]; then
  echo "SUCCESS: Command substitution executed"
  exit 0
else
  echo "FAILURE: Command substitution did not execute"
  exit 1
fi
`;

      fs.writeFileSync(testScriptPath, testScriptContent, { mode: 0o755 });

      // Execute the test script
      const { spawn } = require('child_process');
      const proc = spawn('bash', [testScriptPath]);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        // Cleanup
        fs.unlinkSync(testScriptPath);

        // Verify
        expect(code).to.equal(0, `Script failed: ${stderr}\n${stdout}`);
        expect(stdout).to.include('SUCCESS: Command substitution executed');
        expect(stdout).to.include('Prompt content length:');

        // Verify content length matches our test file
        const lengthMatch = stdout.match(/Prompt content length: (\d+)/);
        if (lengthMatch) {
          const contentLength = parseInt(lengthMatch[1], 10);
          expect(contentLength).to.equal(testPromptContent.length);
        }

        done();
      });
    });
  });

  describe('Security Validation', () => {
    it('should reject prompt file path traversal attempts', () => {
      const sessionId = 'test-session-12345';
      const maliciousPath = '../../../etc/passwd';

      expect(() => {
        buildClaudeCommand(sessionId, maliciousPath);
      }).to.throw(/not found|access/i);
    });

    it('should handle prompt files with special characters in path', () => {
      const specialDir = path.join(os.tmpdir(), 'test dir with spaces');
      if (!fs.existsSync(specialDir)) {
        fs.mkdirSync(specialDir);
      }

      const specialPromptFile = path.join(specialDir, "prompt's file.md");
      fs.writeFileSync(specialPromptFile, '# Test');

      try {
        const sessionId = 'test-session-12345';
        const cmdArray = buildClaudeCommand(sessionId, specialPromptFile);
        const claudeCmd = cmdArray.join(' ');

        // Should contain the path with proper quoting
        expect(claudeCmd).to.include(specialPromptFile);

        // Should use $(cat "path") format
        expect(claudeCmd).to.match(/\$\(cat\s+"[^"]+"\)/);
      } finally {
        // Cleanup
        fs.unlinkSync(specialPromptFile);
        fs.rmdirSync(specialDir);
      }
    });
  });

  describe('Regression Tests', () => {
    it('should NOT embed file content directly (E2BIG regression)', () => {
      const sessionId = 'test-session-12345';
      const cmdArray = buildClaudeCommand(sessionId, testPromptFile);
      const claudeCmd = cmdArray.join(' ');

      // Command should be short (just the $(cat) syntax, not the content)
      expect(claudeCmd.length).to.be.lessThan(500);

      // Should NOT contain the actual prompt content
      expect(claudeCmd).to.not.include('This is a test system prompt');

      // Should contain command substitution instead
      expect(claudeCmd).to.include('$(cat');
    });

    it('should NOT use nested/escaped quotes (triple-quote regression)', () => {
      const sessionId = 'test-session-12345';
      const cmdArray = buildClaudeCommand(sessionId, testPromptFile);
      const claudeCmd = cmdArray.join(' ');

      // Should NOT have triple quotes like '''
      expect(claudeCmd).to.not.include("'''");
      expect(claudeCmd).to.not.include('"""');

      // Should NOT have escaped quotes in the session ID
      expect(cmdArray).to.not.deep.include(`'${sessionId}'`);
    });

    it('should NOT treat $(cat) as literal string (command substitution regression)', () => {
      const sessionId = 'test-session-12345';
      const cmdArray = buildClaudeCommand(sessionId, testPromptFile);
      const claudeCmd = cmdArray.join(' ');

      const scriptLine = `bash -c "${claudeCmd}"`;

      // The $(cat) should NOT be escaped/quoted in a way that prevents substitution
      // It should be inside double quotes (which allow substitution)
      expect(scriptLine).to.match(/bash -c ".*\$\(cat\s+"[^"]+"\).*"/);

      // Should NOT have single quotes around the whole command (which would prevent substitution)
      expect(scriptLine).to.not.match(/bash -c '.*\$\(cat.*\).*'/);
    });
  });
});
