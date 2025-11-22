import { Connection, Client } from '@temporalio/client';
import type { PackageBuilderInput } from '../packages/agents/package-builder-production/src/types/index.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        AI Content Generator Package Builder                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('📦 Building ai-content-generator package from plan file');
  console.log('📁 Plan: plans/packages/service/ai-content-generator.md');
  console.log('🤖 Using PackageBuilderWorkflow with planPath mode');
  console.log('🔗 Will parse and build dependencies automatically');
  console.log('');

  // Validate environment
  if (!process.env.NPM_TOKEN) {
    console.error('❌ Error: NPM_TOKEN environment variable not set');
    console.error('   Please set NPM_TOKEN in your .env file');
    console.error('');
    process.exit(1);
  }

  // Connect to Temporal
  console.log('📋 Step 1: Connecting to Temporal');
  console.log('   Address: localhost:7233');
  console.log('   Namespace: default');

  const connection = await Connection.connect({
    address: 'localhost:7233',
  });

  const client = new Client({ connection, namespace: 'default' });
  console.log('   ✅ Connected to Temporal');
  console.log('');

  // Build configuration
  const buildId = `ai-content-generator-${Date.now()}`;
  const workflowId = `build-${buildId}`;
  const workspaceRoot = '/Users/mattbernier/projects/tools';

  console.log('📋 Step 2: Configuring Workflow');
  console.log(`   Build ID: ${buildId}`);
  console.log(`   Workflow ID: ${workflowId}`);
  console.log(`   Workspace: ${workspaceRoot}`);
  console.log('   Plan Path: plans/packages/service/ai-content-generator.md');
  console.log('   Max Concurrent: 4 packages');
  console.log('   Task Queue: engine');
  console.log(`   Turn-Based Generation: ${process.env.ENABLE_TURN_BASED_GENERATION === 'true' ? 'ENABLED' : 'DISABLED'}`);
  console.log('');

  // Prepare workflow input
  const input: PackageBuilderInput = {
    buildId,
    workspaceRoot,
    planPath: 'plans/packages/service/ai-content-generator.md',
    config: {
      npmRegistry: 'https://registry.npmjs.org',
      npmToken: process.env.NPM_TOKEN!,
      workspaceRoot,
      maxConcurrentBuilds: 4,
      temporal: {
        address: 'localhost:7233',
        namespace: 'default',
        taskQueue: 'engine'
      },
      testing: {
        enableCoverage: true,
        minCoveragePercent: 80,
        failOnError: true
      },
      publishing: {
        dryRun: false,
        requireTests: true,
        requireCleanWorkingDirectory: false
      },
      features: {
        enableTurnBasedGeneration: process.env.ENABLE_TURN_BASED_GENERATION === 'true'
      }
    },
  };

  console.log('📋 Step 3: Starting PackageBuilderWorkflow');
  console.log('   ✅ Workflow started!');
  console.log('');
  console.log('   🔍 View in Temporal UI:');
  console.log(`   http://localhost:8233/namespaces/default/workflows/${workflowId}`);
  console.log('');

  // Start workflow
  const handle = await client.workflow.start('PackageBuilderWorkflow', {
    taskQueue: 'engine',
    workflowId,
    args: [input],
  });

  console.log('📋 Step 4: Building AI Content Generator Package');
  console.log('   This will:');
  console.log('   1. Parse ai-content-generator.md plan file');
  console.log('   2. Extract all package dependencies');
  console.log('   3. Build dependency graph');
  console.log('   4. Spawn PackageBuildWorkflow for each package');
  console.log('   5. Generate code using package-development-agent');
  console.log('   6. Build, test, and fix each package with AI');
  console.log('   7. Publish to npm registry');
  console.log('   8. Generate comprehensive build report');
  console.log('');

  console.log('════════════════════════════════════════════════════════════');
  console.log('⏳ Waiting for completion (this may take 30-60 minutes)...');
  console.log('');
  console.log('');

  const startTime = Date.now();

  // Wait for completion
  const result = await handle.result();

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('════════════════════════════════════════════════════════════');
  console.log('🎉 AI Content Generator Package Build Complete!');
  console.log('');
  console.log('📊 Results:');
  console.log(`   Total Time: ${duration} minutes`);
  console.log(`   Build ID: ${buildId}`);
  console.log('');
  console.log('📁 Check build report at:');
  console.log(`   /Users/mattbernier/projects/tools/reports/builds/${buildId}/build-report.json`);
  console.log('');
  console.log('✨ All packages published to npm!');
  console.log('   View packages: https://www.npmjs.com/org/bernierllc');
  console.log('');
  console.log('👋 Done!');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
