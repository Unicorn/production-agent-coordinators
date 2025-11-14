#!/usr/bin/env tsx

/**
 * Build a single package using PackageBuildWorkflow
 *
 * Usage:
 *   yarn build:package <plan-file-path>
 *
 * Example:
 *   yarn build:package ~/projects/tools/plans/completed/service/email-template-service.md
 */

import { Connection, Client } from '@temporalio/client';
import { PackageBuildWorkflow } from '@coordinator/agent-package-builder-production';
import type { PackageBuildInput } from '@coordinator/agent-package-builder-production';
import * as fs from 'fs';
import * as path from 'path';
import { config as loadDotenv } from 'dotenv';

// Load environment variables
try {
  loadDotenv();
} catch (error) {
  // .env file not found - OK if system env is set
}

// Validate required environment variables
const requiredEnvVars = ['NPM_TOKEN', 'WORKSPACE_ROOT'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('');
  console.error('Set them in your system environment or .env file:');
  console.error('   NPM_TOKEN=npm_xxxxx');
  console.error('   WORKSPACE_ROOT=/Users/mattbernier/projects/tools');
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Missing plan file path');
    console.error('');
    console.error('Usage:');
    console.error('  yarn build:package <plan-file-path>');
    console.error('');
    console.error('Example:');
    console.error('  yarn build:package ~/projects/tools/plans/completed/service/email-template-service.md');
    process.exit(1);
  }

  const planFilePath = path.resolve(args[0]);

  // Verify plan file exists
  if (!fs.existsSync(planFilePath)) {
    console.error(`❌ Plan file not found: ${planFilePath}`);
    process.exit(1);
  }

  // Extract package info from plan path
  // Expected format: .../plans/completed/<category>/<package-name>.md
  const pathParts = planFilePath.split('/');
  const fileName = pathParts[pathParts.length - 1].replace('.md', '');
  const category = pathParts[pathParts.length - 2];
  const packageName = `@bernierllc/${fileName}`;

  console.log('🚀 Building Package with Temporal Workflow');
  console.log(`   Package: ${packageName}`);
  console.log(`   Category: ${category}`);
  console.log(`   Plan: ${planFilePath}`);
  console.log(`   Workspace: ${process.env.WORKSPACE_ROOT}`);
  console.log('');

  // Load configuration
  const workspaceRoot = process.env.WORKSPACE_ROOT!;
  const packagePath = path.join(workspaceRoot, 'packages', category, fileName);

  // Build config
  const buildConfig = {
    npmRegistry: 'https://registry.npmjs.org/',
    npmToken: process.env.NPM_TOKEN!,
    workspaceRoot,
    maxConcurrentBuilds: 1,
    temporal: {
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
      taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'agent-coordinator-queue'
    },
    testing: {
      enableCoverage: true,
      minCoveragePercent: 80,
      failOnError: true
    },
    publishing: {
      dryRun: process.env.DRY_RUN === 'true',
      requireTests: true,
      requireCleanWorkingDirectory: true
    }
  };

  // Connect to Temporal
  console.log('📡 Connecting to Temporal...');
  const connection = await Connection.connect({
    address: buildConfig.temporal.address
  });

  const client = new Client({
    connection,
    namespace: buildConfig.temporal.namespace
  });

  console.log('   ✅ Connected to Temporal\n');

  // Prepare workflow input
  const input: PackageBuildInput = {
    packageName,
    packagePath,
    planPath: planFilePath,
    category: category as any,
    dependencies: [], // Will be read from package.json if exists
    workspaceRoot,
    config: buildConfig
  };

  // Start workflow
  const workflowId = `build-${fileName}-${Date.now()}`;

  console.log('🎬 Starting PackageBuildWorkflow...');
  console.log(`   Workflow ID: ${workflowId}`);
  console.log(`   Task Queue: ${buildConfig.temporal.taskQueue}`);
  console.log('');

  const handle = await client.workflow.start(PackageBuildWorkflow, {
    taskQueue: buildConfig.temporal.taskQueue,
    workflowId,
    args: [input]
  });

  console.log('⏳ Waiting for build to complete...');
  console.log(`   View in Temporal UI: http://localhost:8233/namespaces/${buildConfig.temporal.namespace}/workflows/${workflowId}`);
  console.log('');

  // Wait for result
  try {
    const result = await handle.result();

    console.log('');
    if (result.success) {
      console.log('✅ Package built successfully!');
      console.log('');
      console.log('📊 Build Report:');
      console.log(`   Package: ${result.packageName}`);
      console.log(`   Duration: ${(result.report.duration / 1000).toFixed(1)}s`);
      console.log(`   Build Time: ${(result.report.buildMetrics.buildTime / 1000).toFixed(1)}s`);
      console.log(`   Test Time: ${(result.report.buildMetrics.testTime / 1000).toFixed(1)}s`);
      console.log(`   Test Coverage: ${result.report.quality.testCoverage}%`);
      console.log(`   Quality Checks: ${result.report.buildMetrics.qualityCheckTime / 1000}s`);
      console.log(`   Publish Time: ${(result.report.buildMetrics.publishTime / 1000).toFixed(1)}s`);
      if (result.report.fixAttempts.length > 0) {
        console.log(`   Fix Attempts: ${result.report.fixAttempts.length}`);
      }
      console.log('');
      console.log(`📄 Report: ${workspaceRoot}/production/reports/${new Date().toISOString().split('T')[0]}/${fileName}.json`);
    } else {
      console.log('❌ Package build failed!');
      console.log('');
      console.log(`   Failed Phase: ${result.failedPhase}`);
      console.log(`   Error: ${result.error}`);
      if (result.fixAttempts) {
        console.log(`   Fix Attempts: ${result.fixAttempts}`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('');
    console.error('❌ Workflow failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
