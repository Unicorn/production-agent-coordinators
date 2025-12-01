#!/usr/bin/env node
/**
 * Integration Test: End-to-End Package Build with PR Creation
 * 
 * This script runs a real workflow execution to test:
 * - Complete package build
 * - Git operations (commit, push)
 * - PR creation
 * - Hook execution
 * - Audit logging
 * 
 * Usage:
 *   npx tsx src/test-integration-e2e.ts --plan <path-to-plan.md> [options]
 * 
 * Options:
 *   --plan, -p         Path to package plan/spec (required)
 *   --requirements, -r Path to requirements (optional)
 *   --task-queue, -q   Temporal task queue (default: agent-coordinator-queue)
 *   --create-pr        Create PR (default: false for testing)
 *   --dry-run          Don't execute, just show what would happen
 */

import { Connection, Client } from '@temporalio/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import type { ClaudeAuditedBuildWorkflowResult } from './claude-workflows';
import { cleanupTestResources } from './test-cleanup-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_REQUIREMENTS_PATH = path.join(__dirname, 'requirements/PACKAGE_REQUIREMENTS.md');

interface TestOptions {
  planPath: string;
  requirementsPath: string;
  taskQueue: string;
  workflowId?: string;
  createPR: boolean;
  dryRun: boolean;
}

function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  const options: TestOptions = {
    planPath: '',
    requirementsPath: DEFAULT_REQUIREMENTS_PATH,
    taskQueue: 'agent-coordinator-queue',
    createPR: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--plan':
      case '-p':
        options.planPath = nextArg || '';
        i++;
        break;
      case '--requirements':
      case '-r':
        options.requirementsPath = nextArg || DEFAULT_REQUIREMENTS_PATH;
        i++;
        break;
      case '--task-queue':
      case '-q':
        options.taskQueue = nextArg || 'agent-coordinator-queue';
        i++;
        break;
      case '--workflow-id':
      case '-w':
        options.workflowId = nextArg;
        i++;
        break;
      case '--create-pr':
        options.createPR = true;
        break;
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  if (!options.planPath) {
    console.error('Error: --plan (-p) is required');
    printHelp();
    process.exit(1);
  }

  return options;
}

function printHelp(): void {
  console.log(`
Integration Test: End-to-End Package Build with PR Creation

Usage:
  npx tsx src/test-integration-e2e.ts --plan <path-to-plan.md> [options]

Options:
  --plan, -p         Path to package plan/spec file (required)
  --requirements, -r Path to requirements file (optional)
  --task-queue, -q   Temporal task queue (default: agent-coordinator-queue)
  --workflow-id, -w  Custom workflow ID (optional)
  --create-pr        Create PR (default: false for testing)
  --dry-run, -d     Don't execute, just show what would happen
  --help, -h         Show this help

Examples:
  # Test build without PR creation
  npx tsx src/test-integration-e2e.ts -p ./test-package.md

  # Test build with PR creation
  npx tsx src/test-integration-e2e.ts -p ./test-package.md --create-pr

Prerequisites:
  1. Temporal server running: temporal server start-dev
  2. Worker running: npm run build && node dist/worker.js
  3. Claude CLI authenticated
  4. GitHub CLI authenticated (if --create-pr)
`);
}

async function readFile(filePath: string, description: string): Promise<string> {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    console.log(`✅ Loaded ${description}: ${absolutePath} (${content.length} chars)`);
    return content;
  } catch (error) {
    console.error(`❌ Failed to read ${description}: ${absolutePath}`);
    throw error;
  }
}

function extractPackageName(planContent: string): string {
  const patterns = [
    /^#\s*(?:Implementation Plan:\s*)?(@bernierllc\/[\w-]+)/m,
    /"name":\s*"(@bernierllc\/[\w-]+)"/,
    /Package Overview[\s\S]*?(@bernierllc\/[\w-]+)/,
    /name:\s*(@bernierllc\/[\w-]+)/,
    /`(@bernierllc\/[\w-]+)`/,
  ];

  for (const pattern of patterns) {
    const match = planContent.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return 'test-package';
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Integration Test: E2E Package Build                     ║');
  console.log('║   Testing complete workflow with PR creation               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const options = parseArgs();

  // Read input files
  console.log('📂 Loading input files...\n');
  const specContent = await readFile(options.planPath, 'Plan/Spec file');
  const requirementsContent = await readFile(options.requirementsPath, 'Requirements file');

  // Extract package name
  const packageName = extractPackageName(specContent);
  const sanitizedName = packageName.replace('@', '').replace('/', '-');
  const workflowId = options.workflowId || `integration-test-${sanitizedName}-${Date.now()}`;

  console.log(`\n📦 Package: ${packageName}`);
  console.log(`🔗 Workflow ID: ${workflowId}`);
  console.log(`📋 Task Queue: ${options.taskQueue}`);
  console.log(`🔀 Create PR: ${options.createPR ? 'Yes' : 'No'}`);

  if (options.dryRun) {
    console.log('\n🏃 DRY RUN MODE - Not executing workflow');
    console.log('\nWould execute:');
    console.log(`  - Workflow: ClaudeAuditedBuildWorkflow`);
    console.log(`  - Package: ${packageName}`);
    console.log(`  - Create PR: ${options.createPR}`);
    console.log(`  - Workflow ID: ${workflowId}`);
    return;
  }

  // Connect to Temporal
  console.log('\n🔌 Connecting to Temporal...');
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';

  let connection: Connection | null = null;
  let client: Client | null = null;
  const workspacePaths: string[] = [];

  // Setup cleanup handler
  const cleanup = async () => {
    if (client && workflowId) {
      try {
        await cleanupTestResources(client, {
          workflowIds: [workflowId],
          workspacePaths,
          cancelWorkflows: true,
          removeWorkspaces: true,
          killProcesses: false, // Don't kill processes automatically
        });
      } catch (error) {
        console.error('⚠️  Error during cleanup:', error);
      }
    }
    if (connection) {
      await connection.close();
    }
  };

  // Register cleanup handlers
  process.on('SIGINT', async () => {
    console.log('\n\n⚠️  Interrupted - cleaning up...');
    await cleanup();
    process.exit(1);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n⚠️  Terminated - cleaning up...');
    await cleanup();
    process.exit(1);
  });

  process.on('uncaughtException', async (error) => {
    console.error('\n\n❌ Uncaught exception - cleaning up...', error);
    await cleanup();
    process.exit(1);
  });

  try {
    connection = await Connection.connect({
      address: temporalAddress,
    });
    console.log(`✅ Connected to Temporal at ${temporalAddress}`);

    client = new Client({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    });

    // Start the workflow
    console.log(`\n🚀 Starting ClaudeAuditedBuildWorkflow...`);
    console.log(`   This will:`);
    console.log(`   1. Set up workspace with CLAUDE.md`);
    console.log(`   2. Scaffold package structure`);
    console.log(`   3. Implement source code`);
    console.log(`   4. Run compliance checks`);
    console.log(`   5. Self-correct if needed`);
    if (options.createPR) {
      console.log(`   6. Commit changes`);
      console.log(`   7. Push to branch`);
      console.log(`   8. Create PR`);
    }
    console.log();

    const handle = await client.workflow.start('ClaudeAuditedBuildWorkflow', {
      taskQueue: options.taskQueue,
      workflowId,
      args: [{
        specFileContent: specContent,
        requirementsFileContent: requirementsContent,
        createPR: options.createPR,
        useArchitecturePlanning: false, // Use simple workflow for testing
        prConfig: options.createPR ? {
          branchName: `integration-test-${sanitizedName}-${Date.now()}`,
          baseBranch: 'main',
          title: `feat: Integration test build for ${packageName}`,
          body: `Automated integration test build.\n\nWorkflow ID: ${workflowId}`,
          draft: true,
          labels: ['integration-test', 'automated'],
        } : undefined,
      }],
    });

    console.log(`✅ Workflow started!`);
    console.log(`   Workflow ID: ${handle.workflowId}`);
    console.log(`   Run ID: ${handle.firstExecutionRunId}`);
    console.log(`\n⏳ Waiting for workflow to complete...`);
    console.log(`   (Check Temporal UI at http://localhost:8233)`);
    console.log(`   (This may take several minutes)\n`);

    // Wait for result with timeout
    const resultPromise = handle.result();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Workflow execution timeout (30 minutes)')), 30 * 60 * 1000)
    );

    let result: ClaudeAuditedBuildWorkflowResult;
    try {
      result = await Promise.race([resultPromise, timeoutPromise]) as ClaudeAuditedBuildWorkflowResult;
    } catch (error: any) {
      if (error.message.includes('timeout')) {
        console.error('\n❌ Workflow execution timed out after 30 minutes');
        console.error('   Cancelling workflow and cleaning up...');
        await handle.cancel();
        await cleanup();
        process.exit(1);
      }
      throw error;
    }

    // Track workspace for cleanup
    if (result.workspacePath) {
      try {
        await fs.access(result.workspacePath);
        workspacePaths.push(result.workspacePath);
      } catch {
        // Workspace doesn't exist, skip cleanup
      }
    }

    console.log('\n✅ Workflow completed successfully!');
    console.log('═'.repeat(60));
    console.log('Result:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Workspace: ${result.workspacePath}`);
    console.log(`  Total Cost: $${result.totalCost.toFixed(4)}`);
    console.log(`  Session ID: ${result.sessionId || 'N/A'}`);
    console.log(`  Repair Attempts: ${result.repairAttempts || 0}`);
    if (result.prUrl) {
      console.log(`  PR URL: ${result.prUrl}`);
    }
    console.log('═'.repeat(60));

    // Check for audit logs
    if (result.workspacePath) {
      const auditPath = path.join(result.workspacePath, 'audit_trace.jsonl');
      try {
        const auditContent = await fs.readFile(auditPath, 'utf-8');
        const auditLines = auditContent.trim().split('\n').filter(line => line.trim());
        console.log(`\n📊 Audit Log: ${auditLines.length} entries`);
      } catch {
        console.log(`\n⚠️  No audit log found at ${auditPath}`);
      }

      // Check for hook logs
      const toolCallLogPath = path.join(result.workspacePath, 'tool_call_log.jsonl');
      const responseLogPath = path.join(result.workspacePath, 'response_log.jsonl');
      
      try {
        const toolCalls = await fs.readFile(toolCallLogPath, 'utf-8');
        const toolCallLines = toolCalls.trim().split('\n').filter(line => line.trim());
        console.log(`📝 Tool Call Log: ${toolCallLines.length} entries`);
      } catch {
        console.log(`⚠️  No tool call log found`);
      }

      try {
        const responses = await fs.readFile(responseLogPath, 'utf-8');
        const responseLines = responses.trim().split('\n').filter(line => line.trim());
        console.log(`💬 Response Log: ${responseLines.length} entries`);
      } catch {
        console.log(`⚠️  No response log found`);
      }
    }

    console.log('\n✅ Integration test completed successfully!');

    // Cleanup on success (optional - comment out to keep workspace for inspection)
    if (process.env.KEEP_WORKSPACE !== 'true') {
      console.log('\n🧹 Cleaning up test resources...');
      await cleanupTestResources(client, {
        workflowIds: [workflowId],
        workspacePaths,
        cancelWorkflows: false, // Already completed
        removeWorkspaces: true,
        killProcesses: false,
      });
    } else {
      console.log('\nℹ️  Keeping workspace (KEEP_WORKSPACE=true)');
      console.log(`   Workspace: ${result.workspacePath}`);
    }

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('UNAVAILABLE') || error.message.includes('connect')) {
        console.error('\n❌ Failed to connect to Temporal server');
        console.error('   Make sure Temporal is running: temporal server start-dev');
      } else if (error.message.includes('Worker')) {
        console.error('\n❌ Worker not available for task queue');
        console.error('   Make sure worker is running: npm run build && node dist/worker.js');
      } else {
        console.error('\n❌ Workflow failed:', error.message);
        console.error('   Stack:', error.stack);
      }
    } else {
      console.error('\n❌ Unknown error:', error);
    }

    // Cleanup on error
    if (client && workflowId) {
      console.log('\n🧹 Cleaning up after error...');
      try {
        await cleanupTestResources(client, {
          workflowIds: [workflowId],
          workspacePaths,
          cancelWorkflows: true,
          removeWorkspaces: true,
          killProcesses: false,
        });
      } catch (cleanupError) {
        console.error('⚠️  Error during cleanup:', cleanupError);
      }
    }

    if (connection) {
      await connection.close();
    }
    process.exit(1);
  }
}

main();

