#!/usr/bin/env node

/**
 * Startup Performance Benchmark Script
 *
 * Measures application startup time from launch to interactive.
 * Runs 10 cold starts and collects performance metrics.
 *
 * Usage:
 *   npm run build
 *   node scripts/benchmark-startup.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const RUNS = 10;
const APP_PATH = path.join(__dirname, '../dist/mac-arm64/Universal Session Viewer.app/Contents/MacOS/Universal Session Viewer');
const LOG_FILE = path.join(__dirname, '../startup-benchmark.json');

// Check if app exists
if (!fs.existsSync(APP_PATH)) {
  console.error('Error: App not found at', APP_PATH);
  console.error('Run "npm run build:mac:unsigned" first');
  process.exit(1);
}

console.log('=== Startup Performance Benchmark ===');
console.log(`Runs: ${RUNS}`);
console.log(`App: ${APP_PATH}`);
console.log('');

const results = [];

async function runBenchmark(runNumber) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let logs = '';

    console.log(`Run ${runNumber}/${RUNS}: Starting app...`);

    const app = spawn(APP_PATH, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
    });

    let appReady = false;
    let appInteractive = false;

    // Capture stdout for performance markers
    app.stdout.on('data', (data) => {
      logs += data.toString();
    });

    app.stderr.on('data', (data) => {
      const text = data.toString();
      logs += text;

      // Look for performance markers
      if (text.includes('=== Startup Performance ===')) {
        appReady = true;
      }
      if (text.includes('app-interactive:')) {
        appInteractive = true;
      }
    });

    // Wait for app to become interactive (5 seconds timeout)
    const timeout = setTimeout(() => {
      if (!appInteractive) {
        console.log(`  Timeout waiting for app to become interactive`);
      }
      cleanup();
    }, 5000);

    function cleanup() {
      clearTimeout(timeout);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Parse performance metrics from logs
      const metrics = parsePerformanceMetrics(logs);

      results.push({
        run: runNumber,
        totalTime,
        ...metrics,
      });

      console.log(`  Total time: ${totalTime}ms`);
      if (metrics.handshakeDuration) {
        console.log(`  Handshake: ${metrics.handshakeDuration}ms`);
      }
      if (metrics.sessionLoadDuration) {
        console.log(`  Session load: ${metrics.sessionLoadDuration}ms`);
      }
      if (metrics.totalStartup) {
        console.log(`  App interactive: ${metrics.totalStartup}ms`);
      }
      console.log('');

      // Kill app
      app.kill('SIGTERM');

      // Wait a bit before next run
      setTimeout(() => resolve(), 1000);
    }

    // If app exits early, that's an error
    app.on('exit', (code) => {
      if (!appInteractive) {
        console.log(`  App exited early with code ${code}`);
        cleanup();
      }
    });

    // Check if app became interactive
    const checkInterval = setInterval(() => {
      if (appInteractive) {
        clearInterval(checkInterval);
        cleanup();
      }
    }, 100);
  });
}

function parsePerformanceMetrics(logs) {
  const metrics = {};

  // Extract performance measurements from console logs
  const handshakeMatch = logs.match(/handshake-duration:\s+([\d.]+)ms/);
  if (handshakeMatch) {
    metrics.handshakeDuration = parseFloat(handshakeMatch[1]);
  }

  const sessionLoadMatch = logs.match(/session-load-duration:\s+([\d.]+)ms/);
  if (sessionLoadMatch) {
    metrics.sessionLoadDuration = parseFloat(sessionLoadMatch[1]);
  }

  const totalStartupMatch = logs.match(/total-startup:\s+([\d.]+)ms/);
  if (totalStartupMatch) {
    metrics.totalStartup = parseFloat(totalStartupMatch[1]);
  }

  const importsMatch = logs.match(/imports-to-render:\s+([\d.]+)ms/);
  if (importsMatch) {
    metrics.importsToRender = parseFloat(importsMatch[1]);
  }

  return metrics;
}

async function runAllBenchmarks() {
  for (let i = 1; i <= RUNS; i++) {
    await runBenchmark(i);
  }

  // Calculate statistics
  const stats = calculateStats(results);

  console.log('=== Benchmark Results ===');
  console.log('');
  console.log('Total Time (ms):');
  console.log(`  Mean:   ${stats.totalTime.mean.toFixed(1)}`);
  console.log(`  Median: ${stats.totalTime.median.toFixed(1)}`);
  console.log(`  Min:    ${stats.totalTime.min.toFixed(1)}`);
  console.log(`  Max:    ${stats.totalTime.max.toFixed(1)}`);
  console.log(`  StdDev: ${stats.totalTime.stdDev.toFixed(1)}`);
  console.log('');

  if (stats.handshakeDuration.count > 0) {
    console.log('Handshake Duration (ms):');
    console.log(`  Mean:   ${stats.handshakeDuration.mean.toFixed(1)}`);
    console.log(`  Median: ${stats.handshakeDuration.median.toFixed(1)}`);
    console.log('');
  }

  if (stats.sessionLoadDuration.count > 0) {
    console.log('Session Load Duration (ms):');
    console.log(`  Mean:   ${stats.sessionLoadDuration.mean.toFixed(1)}`);
    console.log(`  Median: ${stats.sessionLoadDuration.median.toFixed(1)}`);
    console.log('');
  }

  if (stats.totalStartup.count > 0) {
    console.log('App Interactive Time (ms):');
    console.log(`  Mean:   ${stats.totalStartup.mean.toFixed(1)}`);
    console.log(`  Median: ${stats.totalStartup.median.toFixed(1)}`);
    console.log('');
  }

  // Save results to file
  fs.writeFileSync(
    LOG_FILE,
    JSON.stringify({ timestamp: new Date().toISOString(), results, stats }, null, 2)
  );
  console.log(`Results saved to ${LOG_FILE}`);
}

function calculateStats(results) {
  const metrics = ['totalTime', 'handshakeDuration', 'sessionLoadDuration', 'totalStartup', 'importsToRender'];
  const stats = {};

  metrics.forEach((metric) => {
    const values = results
      .map((r) => r[metric])
      .filter((v) => v !== undefined && !isNaN(v));

    if (values.length === 0) {
      stats[metric] = { count: 0 };
      return;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    stats[metric] = {
      count: values.length,
      mean,
      median,
      min,
      max,
      stdDev,
    };
  });

  return stats;
}

// Run benchmarks
runAllBenchmarks().catch((error) => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
