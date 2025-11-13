#!/usr/bin/env node
/**
 * Temporal Worker for Suite Builder Production
 *
 * This worker connects to Temporal server and executes workflows and activities
 * for the autonomous package building system.
 *
 * Usage:
 *   node dist/worker.bundle.js (production/bundled)
 *   tsx src/worker.ts (development)
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import * as discoveryActivities from './activities/discovery.activities.js';
import * as planningActivities from './activities/planning.activities.js';
import * as meceActivities from './activities/mece.activities.js';
import * as buildActivities from './activities/build.activities.js';
import * as qualityActivities from './activities/quality.activities.js';
import * as publishActivities from './activities/publish.activities.js';
import * as reportActivities from './activities/report.activities.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Temporal Worker - Suite Builder Production             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Connect to Temporal server
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  console.log('🔌 Connecting to Temporal server...');
  const connection = await NativeConnection.connect({
    address: temporalAddress,
  });
  console.log('   ✅ Connected to Temporal at:', temporalAddress);

  // Determine workflow bundle path
  // Always use TypeScript source to avoid ESM .js extension issues
  // Temporal's webpack will compile TypeScript on the fly
  // When bundled, __dirname is 'dist', so we need to go back to src
  const isBuilt = __filename.includes('worker.bundle.js');
  const workflowsPath = isBuilt
    ? join(__dirname, '../src/workflows')
    : join(__dirname, 'workflows');

  console.log('\n📦 Creating worker...');
  console.log('   Task Queue:', process.env.TEMPORAL_TASK_QUEUE || 'suite-builder');
  console.log('   Workflows:', workflowsPath);
  console.log('   Activities: 7 modules loaded (discovery, planning, mece, build, quality, publish, report)');

  // Create worker
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'suite-builder',
    workflowsPath,
    activities: {
      ...discoveryActivities,
      ...planningActivities,
      ...meceActivities,
      ...buildActivities,
      ...qualityActivities,
      ...publishActivities,
      ...reportActivities,
    },
    // Worker options
    maxConcurrentActivityTaskExecutions: 3, // Match config: maxConcurrentBuilds
    maxConcurrentWorkflowTaskExecutions: 3,
    // Bundler options - ignore Node.js modules that are only used in activities
    bundlerOptions: {
      ignoreModules: [
        'fs',
        'fs/promises',
        'path',
        'child_process',
        'glob',
        'semver',
      ],
      // Set fixed publicPath and global object for Node.js VM environment
      webpackConfigHook: (config) => {
        config.output = config.output || {};
        config.output.publicPath = '';
        config.output.globalObject = 'globalThis'; // Use globalThis instead of self for Node.js
        return config;
      },
    },
  });

  console.log('\n🚀 Worker is ready!');
  console.log('   Listening on task queue: suite-builder');
  console.log('   Waiting for workflows...\n');
  console.log('   Press Ctrl+C to shutdown\n');

  // Run worker
  await worker.run();

  console.log('\n👋 Worker shutdown complete');
}

run().catch((err) => {
  console.error('❌ Worker failed:', err);
  process.exit(1);
});
