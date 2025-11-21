#!/usr/bin/env tsx

/**
 * Content Management Suite Builder
 *
 * This script builds the content-management suite package and all its dependencies
 * using the new flexible PackageBuilderWorkflow with planPath input.
 *
 * Features:
 * - Reads plan file directly (no audit report needed)
 * - Parses dependencies automatically from plan
 * - Builds packages in dependency order
 * - AI-powered error recovery
 * - Automatic testing and publishing
 *
 * Prerequisites:
 * - Temporal infrastructure running (localhost:7233)
 * - Worker running on 'engine' task queue
 * - NPM_TOKEN environment variable set
 *
 * Run with: npx tsx examples/build-content-management-suite.ts
 */

import { Connection, Client } from '@temporalio/client';
import { PackageBuilderWorkflow } from '../packages/agents/package-builder-production/dist/workflows/package-builder.workflow.js';
import type { PackageBuilderInput } from '../packages/agents/package-builder-production/dist/types/index.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Content Management Suite Builder                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📦 Building content-management suite from plan file');
  console.log('📁 Plan: plans/packages/suite/content-management-suite.md');
  console.log('🤖 Using PackageBuilderWorkflow with planPath mode');
  console.log('🔗 Will parse and build dependencies automatically\n');

  // Validate environment
  if (!process.env.NPM_TOKEN) {
    console.error('❌ Error: NPM_TOKEN environment variable not set');
    console.error('   Please set NPM_TOKEN in your .env file\n');
    process.exit(1);
  }

  // Connect to Temporal
  console.log('📋 Step 1: Connecting to Temporal');
  console.log('   Address: localhost:7233');
  console.log('   Namespace: default');

  try {
    const connection = await Connection.connect({
      address: 'localhost:7233',
    });

    const client = new Client({
      connection,
      namespace: 'default',
    });

    console.log('   ✅ Connected to Temporal\n');

    // Configure workflow input
    const buildId = `content-management-suite-${Date.now()}`;
    const workflowId = `build-content-management-${Date.now()}`;
    const workspaceRoot = '/Users/mattbernier/projects/tools';

    const input: PackageBuilderInput = {
      buildId,
      workspaceRoot,
      planPath: 'plans/packages/suite/content-management-suite.md', // 👈 Direct plan path!
      config: {
        npmRegistry: 'https://registry.npmjs.org',
        npmToken: process.env.NPM_TOKEN!,
        workspaceRoot,
        maxConcurrentBuilds: 4, // Build 4 packages at once
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
          requireCleanWorkingDirectory: false // Allow uncommitted changes
        }
      }
    };

    console.log('📋 Step 2: Configuring Workflow');
    console.log(`   Build ID: ${buildId}`);
    console.log(`   Workflow ID: ${workflowId}`);
    console.log(`   Workspace: ${workspaceRoot}`);
    console.log(`   Plan Path: ${input.planPath}`);
    console.log(`   Max Concurrent: ${input.config.maxConcurrentBuilds} packages`);
    console.log(`   Task Queue: engine\n`);

    // Start workflow
    console.log('📋 Step 3: Starting PackageBuilderWorkflow');

    const handle = await client.workflow.start(PackageBuilderWorkflow, {
      taskQueue: 'engine',
      workflowId,
      args: [input],
    });

    console.log('   ✅ Workflow started!\n');
    console.log('   🔍 View in Temporal UI:');
    console.log(`   http://localhost:8233/namespaces/default/workflows/${workflowId}\n`);

    console.log('📋 Step 4: Building Content Management Suite');
    console.log('   This will:');
    console.log('   1. Parse content-management-suite.md plan file');
    console.log('   2. Extract all package dependencies');
    console.log('   3. Build dependency graph');
    console.log('   4. Spawn PackageBuildWorkflow for each package');
    console.log('   5. Generate code using package-development-agent');
    console.log('   6. Build, test, and fix each package with AI');
    console.log('   7. Publish to npm registry');
    console.log('   8. Generate comprehensive build report\n');

    console.log('════════════════════════════════════════════════════════════');
    console.log('⏳ Waiting for completion (this may take 30-60 minutes)...\n');

    // Wait for completion
    const startTime = Date.now();

    try {
      await handle.result();
      const elapsed = Date.now() - startTime;

      console.log('\n════════════════════════════════════════════════════════════');
      console.log('🎉 Content Management Suite Build Complete!\n');
      console.log('📊 Results:');
      console.log(`   Total Time: ${(elapsed / 1000 / 60).toFixed(1)} minutes`);
      console.log(`   Build ID: ${buildId}\n`);

      console.log('📁 Check build report at:');
      console.log(`   ${workspaceRoot}/reports/builds/${buildId}/build-report.json\n`);

      console.log('✨ All packages published to npm!');
      console.log('   View packages: https://www.npmjs.com/org/bernierllc\n');

    } catch (error: any) {
      console.error('\n❌ Workflow failed:', error.message);
      console.error('\n📋 Check logs for details:');
      console.error(`   Temporal UI: http://localhost:8233/namespaces/default/workflows/${workflowId}`);
      console.error(`   Build reports: ${workspaceRoot}/reports/builds/${buildId}/\n`);
      process.exit(1);
    }

    console.log('👋 Done!\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Temporal server not running. Start it with:');
      console.error('   temporal server start-dev\n');
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
