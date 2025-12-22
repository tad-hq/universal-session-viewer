#!/usr/bin/env node

/**
 * Memory Profiling Script for Universal Session Viewer
 *
 * Run with: node scripts/memory-profile.js
 *
 * This script launches the app and takes periodic memory snapshots
 * to detect memory leaks over time.
 *
 * V1 Pattern Context:
 * - Manual memory profiling using Chrome DevTools is time-intensive
 * - This automates the process of taking periodic snapshots
 * - Detects linear memory growth (indicating leaks)
 * - Saves results to JSON for analysis
 *
 * Based on plan: plans/performance/05-MEMORY-STABILITY.md
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const DURATION_MINUTES = 60;
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // Every 5 minutes
const RESULTS_FILE = path.join(__dirname, '..', 'memory-profile-results.json');

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)}MB`;
}

/**
 * Run memory profiling session
 */
async function runMemoryProfile() {
  console.log('🔬 Universal Session Viewer - Memory Profiling');
  console.log('='.repeat(60));
  console.log(`Duration: ${DURATION_MINUTES} minutes`);
  console.log(`Snapshot interval: ${SNAPSHOT_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`Results file: ${RESULTS_FILE}`);
  console.log('='.repeat(60));
  console.log('');

  const results = {
    startTime: new Date().toISOString(),
    config: {
      durationMinutes: DURATION_MINUTES,
      snapshotIntervalMs: SNAPSHOT_INTERVAL_MS,
    },
    snapshots: [],
    endTime: null,
    summary: null,
  };

  console.log('⏳ Launching Electron app...');

  // Launch Electron app in dev mode
  const electron = spawn('npm', ['run', 'electron:dev'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..'),
  });

  console.log('✅ App launched. Starting memory profiling...');
  console.log('');
  console.log('💡 TIP: Use the app normally during profiling:');
  console.log('   - Navigate between sessions');
  console.log('   - Perform searches');
  console.log('   - Expand/collapse sections');
  console.log('   - Open/close settings');
  console.log('');

  // Take periodic snapshots
  const snapshotCount = Math.floor(DURATION_MINUTES * 60 * 1000 / SNAPSHOT_INTERVAL_MS);
  let snapshotIndex = 0;

  // Take initial snapshot immediately
  const initialSnapshot = {
    index: 0,
    timestamp: new Date().toISOString(),
    minute: 0,
    memory: process.memoryUsage(),
  };
  results.snapshots.push(initialSnapshot);
  console.log(`📸 Snapshot 0/${snapshotCount}: Heap ${formatBytes(initialSnapshot.memory.heapUsed)}`);

  // Set up interval for subsequent snapshots
  const intervalId = setInterval(() => {
    snapshotIndex++;

    const snapshot = {
      index: snapshotIndex,
      timestamp: new Date().toISOString(),
      minute: snapshotIndex * (SNAPSHOT_INTERVAL_MS / 60000),
      memory: process.memoryUsage(),
    };

    results.snapshots.push(snapshot);
    console.log(`📸 Snapshot ${snapshotIndex}/${snapshotCount}: Heap ${formatBytes(snapshot.memory.heapUsed)}`);

    // Check if we've completed all snapshots
    if (snapshotIndex >= snapshotCount) {
      clearInterval(intervalId);
      finishProfiling();
    }
  }, SNAPSHOT_INTERVAL_MS);

  /**
   * Finish profiling and save results
   */
  function finishProfiling() {
    results.endTime = new Date().toISOString();

    // Calculate summary statistics
    const heapReadings = results.snapshots.map((s) => s.memory.heapUsed);
    const initialHeap = heapReadings[0];
    const finalHeap = heapReadings[heapReadings.length - 1];
    const totalGrowth = finalHeap - initialHeap;
    const avgHeap = heapReadings.reduce((a, b) => a + b, 0) / heapReadings.length;
    const maxHeap = Math.max(...heapReadings);
    const minHeap = Math.min(...heapReadings);

    results.summary = {
      initialHeap,
      finalHeap,
      totalGrowth,
      avgHeap,
      maxHeap,
      minHeap,
      growthPerHour: (totalGrowth / DURATION_MINUTES) * 60,
    };

    // Save results
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

    console.log('');
    console.log('='.repeat(60));
    console.log('📊 Memory Profiling Complete');
    console.log('='.repeat(60));
    console.log(`Initial heap:     ${formatBytes(initialHeap)}`);
    console.log(`Final heap:       ${formatBytes(finalHeap)}`);
    console.log(`Total growth:     ${formatBytes(totalGrowth)}`);
    console.log(`Growth per hour:  ${formatBytes(results.summary.growthPerHour)}`);
    console.log(`Average heap:     ${formatBytes(avgHeap)}`);
    console.log(`Max heap:         ${formatBytes(maxHeap)}`);
    console.log(`Min heap:         ${formatBytes(minHeap)}`);
    console.log('');

    // Evaluate against threshold
    const THRESHOLD_MB = 20 * 1024 * 1024; // 20MB per hour
    if (results.summary.growthPerHour < THRESHOLD_MB) {
      console.log(`✅ PASS: Growth per hour (${formatBytes(results.summary.growthPerHour)}) is below threshold (20MB)`);
    } else {
      console.log(`❌ FAIL: Growth per hour (${formatBytes(results.summary.growthPerHour)}) exceeds threshold (20MB)`);
      console.log('   This indicates a potential memory leak. Review:');
      console.log('   - Event listener cleanup');
      console.log('   - IPC handler cleanup');
      console.log('   - Timer cleanup');
      console.log('   - Zustand subscription cleanup');
    }

    console.log('');
    console.log(`Results saved to: ${RESULTS_FILE}`);
    console.log('');
    console.log('To analyze results:');
    console.log(`  cat ${RESULTS_FILE} | jq '.summary'`);
    console.log('');

    // Terminate app
    electron.kill();
    process.exit(0);
  }

  // Handle script termination
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Profiling interrupted by user');
    clearInterval(intervalId);
    finishProfiling();
  });

  // Handle app exit
  electron.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n❌ App exited with code ${code}`);
      clearInterval(intervalId);
      process.exit(1);
    }
  });
}

// Run profiling
runMemoryProfile().catch((error) => {
  console.error('❌ Profiling failed:', error);
  process.exit(1);
});
