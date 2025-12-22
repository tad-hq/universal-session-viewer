/**
 * Mock child_process for Main Process Testing
 *
 * PURPOSE: Mock Go backend spawning without actually executing binaries
 *
 * V1 PATTERN CONTEXT:
 * - Main process spawns Go backend via spawn('bin/session-viewer', ['analyze', ...])
 * - stdout contains JSON analysis results
 * - stderr contains error messages
 * - Exit codes: 0 = success, non-zero = error
 */

import { vi } from 'vitest';
import { EventEmitter } from 'events';

export interface MockChildProcess extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: any;
  pid: number;
  kill: ReturnType<typeof vi.fn>;
  _exit: (code: number) => void;
  _writeStdout: (data: string) => void;
  _writeStderr: (data: string) => void;
}

/**
 * Create mock child process
 *
 * V1 Pattern (main.js:2175-2250): Go backend spawn and output capture
 */
export function createMockChildProcess(
  exitCode: number = 0,
  stdoutData: string = '',
  stderrData: string = ''
): MockChildProcess {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const childProcess = new EventEmitter() as MockChildProcess;

  childProcess.stdout = stdout;
  childProcess.stderr = stderr;
  childProcess.stdin = {
    write: vi.fn(),
    end: vi.fn(),
  };
  childProcess.pid = Math.floor(Math.random() * 10000);
  childProcess.kill = vi.fn();

  // Helper to emit stdout data
  childProcess._writeStdout = (data: string) => {
    stdout.emit('data', Buffer.from(data));
  };

  // Helper to emit stderr data
  childProcess._writeStderr = (data: string) => {
    stderr.emit('data', Buffer.from(data));
  };

  // Helper to emit exit event
  childProcess._exit = (code: number) => {
    childProcess.emit('close', code);
    childProcess.emit('exit', code, null);
  };

  // Auto-emit data after a tick if provided
  if (stdoutData || stderrData || exitCode !== null) {
    process.nextTick(() => {
      if (stdoutData) childProcess._writeStdout(stdoutData);
      if (stderrData) childProcess._writeStderr(stderrData);
      childProcess._exit(exitCode);
    });
  }

  return childProcess;
}

/**
 * Create mock spawn function
 *
 * V1 Pattern: spawn() called with command and args array
 */
export function createMockSpawn(
  defaultExitCode: number = 0,
  defaultStdout: string = '',
  defaultStderr: string = ''
) {
  return vi.fn((command: string, args?: string[], options?: any): MockChildProcess => {
    return createMockChildProcess(defaultExitCode, defaultStdout, defaultStderr);
  });
}

/**
 * Create mock child_process module
 *
 * Usage in tests:
 * ```typescript
 * vi.mock('child_process', () => createMockChildProcessModule());
 * ```
 */
export function createMockChildProcessModule(
  exitCode?: number,
  stdout?: string,
  stderr?: string
) {
  return {
    spawn: createMockSpawn(exitCode, stdout, stderr),
    exec: vi.fn(),
    execFile: vi.fn(),
    fork: vi.fn(),
    execSync: vi.fn(),
    execFileSync: vi.fn(),
    spawnSync: vi.fn(),
  };
}

/**
 * Helper to create successful Go backend analysis response
 *
 * V1 Pattern (main.js:2220-2240): Go backend returns JSON on stdout
 */
export function createSuccessfulAnalysisResponse(
  sessionId: string,
  summary: string = 'Test analysis summary'
): string {
  return JSON.stringify({
    success: true,
    sessionId,
    summary,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Helper to create failed Go backend analysis response
 */
export function createFailedAnalysisResponse(error: string = 'Analysis failed'): string {
  return JSON.stringify({
    success: false,
    error,
  });
}
