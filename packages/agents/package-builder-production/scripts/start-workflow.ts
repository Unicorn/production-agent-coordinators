#!/usr/bin/env tsx
/**
 * Start a PackageBuildWorkflow
 * 
 * Usage:
 *   tsx scripts/start-workflow.ts <package-name> <package-path> <plan-path>
 * 
 * Example:
 *   tsx scripts/start-workflow.ts @test/simple-package packages/test/simple-package plans/test/simple-package.md
 */

import { Connection, Client } from '@temporalio/client';
import { PackageBuildWorkflow } from '../src/workflows/package-build.workflow.js';
import type { PackageBuildInput } from '../src/types/index.js';
import * as path from 'path';
import * as fs from 'fs/promises';

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';
const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'engine-cli-e2e';
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Usage: tsx scripts/start-workflow.ts <package-name> <package-path> <plan-path> [category]');
    console.error('');
    console.error('Example:');
    console.error('  tsx scripts/start-workflow.ts @test/simple-package packages/test/simple-package plans/test/simple-package.md test');
    process.exit(1);
  }

  const [packageName, packagePath, planPath, category = 'test'] = args;

  // Validate plan file exists
  const fullPlanPath = path.isAbsolute(planPath) 
    ? planPath 
    : path.join(WORKSPACE_ROOT, planPath);
  
  try {
    await fs.access(fullPlanPath);
  } catch {
    console.error(`❌ Plan file not found: ${fullPlanPath}`);
    process.exit(1);
  }

  console.log('🔗 Connecting to Temporal...');
  const connection = await Connection.connect({
    address: TEMPORAL_ADDRESS,
    namespace: TEMPORAL_NAMESPACE,
  });

  const client = new Client({ connection });

  const input: PackageBuildInput = {
    packageName,
    packagePath,
    planPath,
    category: category as any,
    dependencies: [],
    workspaceRoot: WORKSPACE_ROOT,
    config: {
      npmRegistry: process.env.NPM_REGISTRY || 'https://registry.npmjs.org',
      npmToken: process.env.NPM_TOKEN || '',
      workspaceRoot: WORKSPACE_ROOT,
      maxConcurrentBuilds: 1,
      temporal: {
        address: TEMPORAL_ADDRESS,
        namespace: TEMPORAL_NAMESPACE,
        taskQueue: TASK_QUEUE,
      },
      testing: {
        enableCoverage: true,
        minCoveragePercent: 80,
        failOnError: true,
      },
      publishing: {
        dryRun: true,
        requireTests: true,
        requireCleanWorkingDirectory: false,
      },
    },
  };

  const workflowId = `package-build-${packageName.replace(/[@\/]/g, '-')}-${Date.now()}`;

  console.log('🚀 Starting workflow...');
  console.log(`   Package: ${packageName}`);
  console.log(`   Path: ${packagePath}`);
  console.log(`   Plan: ${planPath}`);
  console.log(`   Workflow ID: ${workflowId}`);
  console.log(`   Task Queue: ${TASK_QUEUE}`);
  console.log('');

  const handle = await client.workflow.start(PackageBuildWorkflow, {
    taskQueue: TASK_QUEUE,
    workflowId,
    args: [input],
  });

  console.log(`✅ Workflow started!`);
  console.log(`   Workflow ID: ${handle.workflowId}`);
  console.log(`   Run ID: ${handle.firstExecutionRunId}`);
  console.log(`   View in UI: http://localhost:8080/namespaces/${TEMPORAL_NAMESPACE}/workflows/${workflowId}`);
  console.log('');
  console.log('⏳ Waiting for workflow to complete...');

  try {
    const result = await handle.result();
    console.log('');
    console.log('✅ Workflow completed!');
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('');
    console.error('❌ Workflow failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

