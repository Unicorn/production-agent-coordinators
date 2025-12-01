#!/usr/bin/env node
/**
 * Test Client for ClaudeAuditedBuildWorkflow
 *
 * Usage:
 *   npx tsx src/test-claude-build-client.ts --plan <path-to-plan.md>
 *
 * Options:
 *   --plan, -p       Path to the package plan/spec file (required)
 *   --requirements   Path to requirements file (optional, uses default)
 *   --task-queue     Temporal task queue (default: agent-coordinator-queue)
 *   --workflow-id    Custom workflow ID (optional, auto-generated)
 *   --premium        Use premium workflow with Opus architecture planning
 *   --dry-run        Print inputs without executing workflow
 *
 * Examples:
 *   # Build content-validator package
 *   npx tsx src/test-claude-build-client.ts -p ./specs/content-validator.md
 *
 *   # With Opus architecture planning (premium)
 *   npx tsx src/test-claude-build-client.ts -p ./my-package.md --premium
 */

import { Connection, Client } from '@temporalio/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import type { ClaudeAuditedBuildWorkflowResult } from './claude-workflows';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default requirements file path
const DEFAULT_REQUIREMENTS_PATH = path.join(__dirname, 'requirements/PACKAGE_REQUIREMENTS.md');

interface ClientOptions {
  planPath: string;
  requirementsPath: string;
  taskQueue: string;
  workflowId?: string;
  premium: boolean;
  dryRun: boolean;
}

function parseArgs(): ClientOptions {
  const args = process.argv.slice(2);
  const options: ClientOptions = {
    planPath: '',
    requirementsPath: DEFAULT_REQUIREMENTS_PATH,
    taskQueue: 'agent-coordinator-queue',
    premium: false,
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
      case '--premium':
        options.premium = true;
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
Test Client for ClaudeAuditedBuildWorkflow (Claude CLI Headless Mode)

Usage:
  npx tsx src/test-claude-build-client.ts --plan <path-to-plan.md> [options]

Options:
  --plan, -p         Path to the package plan/spec file (required)
  --requirements, -r Path to requirements file (optional, uses default BernierLLC)
  --task-queue, -q   Temporal task queue (default: agent-coordinator-queue)
  --workflow-id, -w  Custom workflow ID (optional, auto-generated)
  --premium          Use premium workflow with Opus architecture planning
  --dry-run, -d      Print inputs without executing workflow
  --help, -h         Show this help message

Examples:
  # Build content-validator package
  npx tsx src/test-claude-build-client.ts -p ./specs/content-validator.md

  # With Opus architecture planning (premium mode)
  npx tsx src/test-claude-build-client.ts -p ./my-package.md --premium

  # Dry run to see what would be sent
  npx tsx src/test-claude-build-client.ts -p ./my-package.md --dry-run

Prerequisites:
  1. Temporal server must be running: temporal server start-dev
  2. Worker must be running: npm run build && node dist/worker.js
  3. Claude CLI must be installed and authenticated
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
  // Try to extract package name from plan content
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

  return 'unknown-package';
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   ClaudeAuditedBuildWorkflow Test Client                   ║');
  console.log('║   Claude CLI Headless Mode                                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const options = parseArgs();

  // Read input files
  console.log('📂 Loading input files...\n');
  const specContent = await readFile(options.planPath, 'Plan/Spec file');
  const requirementsContent = await readFile(options.requirementsPath, 'Requirements file');

  // Extract package name for workflow ID
  const packageName = extractPackageName(specContent);
  const sanitizedName = packageName.replace('@', '').replace('/', '-');
  const workflowId = options.workflowId || `claude-build-${sanitizedName}-${Date.now()}`;
  const workflowType = options.premium ? 'ClaudePremiumBuildWorkflow' : 'ClaudeSimpleBuildWorkflow';

  console.log(`\n📦 Package: ${packageName}`);
  console.log(`🔗 Workflow ID: ${workflowId}`);
  console.log(`📋 Task Queue: ${options.taskQueue}`);
  console.log(`🎯 Workflow Type: ${workflowType}`);
  console.log(`   ${options.premium ? '(Using Opus for architecture planning)' : '(Cost-optimized with Sonnet)'}`);

  // Show preview of inputs
  console.log('\n📝 Spec Preview (first 500 chars):');
  console.log('─'.repeat(60));
  console.log(specContent.substring(0, 500) + (specContent.length > 500 ? '...' : ''));
  console.log('─'.repeat(60));

  if (options.dryRun) {
    console.log('\n🏃 DRY RUN MODE - Not executing workflow');
    console.log('\nWould call workflow with:');
    console.log(`  - Workflow: ${workflowType}`);
    console.log(`  - specFileContent: ${specContent.length} characters`);
    console.log(`  - requirementsFileContent: ${requirementsContent.length} characters`);
    console.log(`  - workflowId: ${workflowId}`);
    console.log(`  - taskQueue: ${options.taskQueue}`);
    return;
  }

  // Connect to Temporal
  console.log('\n🔌 Connecting to Temporal...');
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';

  try {
    const connection = await Connection.connect({
      address: temporalAddress,
    });
    console.log(`✅ Connected to Temporal at ${temporalAddress}`);

    const client = new Client({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    });

    // Start the workflow
    console.log(`\n🚀 Starting ${workflowType}...`);
    console.log(`   This will use Claude CLI in headless mode to:`);
    if (options.premium) {
      console.log(`   0. Plan architecture with Opus (extended thinking)`);
    }
    console.log(`   1. Set up workspace with static CLAUDE.md`);
    console.log(`   2. Scaffold package structure (Sonnet)`);
    console.log(`   3. Implement source code (Sonnet, resuming session)`);
    console.log(`   4. Run compliance checks (build, lint, test)`);
    console.log(`   5. Self-correct up to 3 times (model selected per error type)`);
    console.log(`      - ESLint errors → Haiku (fast, cheap)`);
    console.log(`      - Architectural issues → Opus (thorough)`);
    console.log(`      - Other issues → Sonnet (balanced)\n`);

    const handle = await client.workflow.start(workflowType, {
      taskQueue: options.taskQueue,
      workflowId,
      args: [specContent, requirementsContent],
    });

    console.log(`✅ Workflow started!`);
    console.log(`   Workflow ID: ${handle.workflowId}`);
    console.log(`   Run ID: ${handle.firstExecutionRunId}`);
    console.log(`\n⏳ Waiting for workflow to complete...`);
    console.log(`   (You can also check Temporal UI at http://localhost:8233)`);

    // Wait for result
    const result = await handle.result() as ClaudeAuditedBuildWorkflowResult;

    console.log('\n✅ Workflow completed successfully!');
    console.log('─'.repeat(60));
    console.log('Result:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Workspace: ${result.workspacePath}`);
    console.log(`  Total Cost: $${result.totalCost.toFixed(4)}`);
    console.log(`  Session ID: ${result.sessionId}`);
    console.log(`  Repair Attempts: ${result.repairAttempts}`);
    console.log('─'.repeat(60));

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
      }
    } else {
      console.error('\n❌ Unknown error:', error);
    }
    process.exit(1);
  }
}

main();
