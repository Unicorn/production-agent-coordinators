#!/usr/bin/env tsx

/**
 * Suite Builder Multi-Agent Workflow Demo with Temporal
 *
 * This demonstrates:
 * - Multi-phase workflow orchestration (5 phases)
 * - Dependency graph construction and topological sorting
 * - Sequential package builds respecting dependencies
 * - Suite Builder spec state machine
 * - Durable execution for long-running builds (15-43 hours)
 *
 * Prerequisites:
 * - Temporal infrastructure running (yarn infra:up)
 * - Worker running (yarn workspace @coordinator/temporal-coordinator start:worker)
 *
 * Run with: npx tsx examples/demo-suite-builder-temporal.ts
 */

import { Connection, Client } from '@temporalio/client';
import type { SuiteBuilderWorkflowConfig } from '../packages/temporal-coordinator/src/workflows.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Suite Builder Multi-Agent Workflow Demo                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📦 Building test suite with 3 packages');
  console.log('🔗 Dependency chain: package-a → package-b → package-c');
  console.log('🤖 Using SuiteBuilderOrchestratorAgent');
  console.log('⚡ Sequential builds (maxConcurrentBuilds: 1)\n');

  // Connect to Temporal
  console.log('📋 Step 1: Connecting to Temporal');
  console.log('   Address: localhost:7233');

  const connection = await Connection.connect({
    address: 'localhost:7233',
  });

  const client = new Client({
    connection,
    namespace: 'default',
  });

  console.log('   ✅ Connected to Temporal\n');

  // Configure workflow
  const goalId = `suite-builder-${Date.now()}`;
  const workflowId = `suite-builder-workflow-${Date.now()}`;
  const masterPlanPath = path.join(__dirname, 'test-suite', 'master-plan.md');

  const config: SuiteBuilderWorkflowConfig = {
    goalId,
    suiteName: 'test-suite',
    masterPlanPath,
    specConfig: {
      maxConcurrentBuilds: 1, // Sequential builds
      enableMCPLocking: false,
    },
    agentConfig: {
      baseDir: path.join(__dirname, 'test-suite'),
      verbose: true,
    },
    maxIterations: 100, // Higher limit for multi-phase workflow
  };

  console.log('📋 Step 2: Configuring Workflow');
  console.log(`   Goal ID: ${goalId}`);
  console.log(`   Workflow ID: ${workflowId}`);
  console.log(`   Suite Name: test-suite`);
  console.log(`   Master Plan: ${masterPlanPath}`);
  console.log('   Spec Type: suite-builder');
  console.log('   Agent Type: suite-builder-orchestrator');
  console.log('   Max Concurrent Builds: 1 (sequential)\n');

  // Start workflow
  console.log('📋 Step 3: Starting Suite Builder Workflow');
  console.log('   Task Queue: agent-coordinator-queue');

  const handle = await client.workflow.start('suiteBuilderWorkflow', {
    taskQueue: 'agent-coordinator-queue',
    workflowId,
    args: [config],
  });

  console.log('   ✅ Workflow started!\n');

  console.log('📋 Step 4: Watching Suite Build Progress');
  console.log('   (This will execute all 5 phases)\n');
  console.log('════════════════════════════════════════════════════════════\n');

  // Wait for completion
  const startTime = Date.now();
  const result = await handle.result();
  const elapsed = Date.now() - startTime;

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🎉 Suite Build Complete!\n');

  console.log('📊 Final State:');
  console.log(`   Status: ${result.status}`);
  console.log(`   Goal ID: ${goalId}`);
  console.log(`   Total Time: ${(elapsed / 1000).toFixed(1)} seconds`);
  console.log(`   Total Steps: ${Object.keys(result.openSteps).length}\n`);

  // Display phase information
  const suiteBuilderState = (result as any).suiteBuilderState;
  if (suiteBuilderState) {
    console.log('🔄 Phases Executed:');
    console.log(`   INITIALIZE → PLAN → BUILD → VERIFY → COMPLETE\n`);

    if (suiteBuilderState.dependencyGraph) {
      const graph = suiteBuilderState.dependencyGraph;
      console.log('🔗 Dependency Graph:');
      console.log(`   Total Packages: ${graph.nodes?.length || 0}`);
      console.log(`   Total Layers: ${Object.keys(graph.layers || {}).length}`);

      if (graph.buildOrder) {
        console.log('\n   Build Order:');
        graph.buildOrder.forEach((pkgName: string, idx: number) => {
          console.log(`   ${idx + 1}. ${pkgName}`);
        });
      }

      if (graph.layers) {
        console.log('\n   Dependency Layers:');
        Object.entries(graph.layers).forEach(([layer, packages]) => {
          console.log(`   Layer ${layer}: ${(packages as string[]).join(', ')}`);
        });
      }
    }
  }

  // Display executed steps
  console.log('\n📋 Steps Executed:');
  const stepEntries = Object.entries(result.openSteps);
  stepEntries.forEach(([stepId, step], idx) => {
    console.log(`   ${idx + 1}. ${step.kind}`);
    console.log(`      ID: ${stepId}`);
    console.log(`      Status: ${step.status}`);
  });

  // Display artifacts
  if (Object.keys(result.artifacts).length > 0) {
    console.log('\n📦 Artifacts Generated:');
    Object.keys(result.artifacts).forEach((key) => {
      console.log(`   - ${key}`);
    });
  }

  // Display event log
  if (result.log.length > 0) {
    console.log('\n📋 Event Log (last 10 events):');
    result.log.slice(-10).forEach((event) => {
      const timestamp = new Date(event.at).toISOString();
      console.log(`   - [${timestamp}] ${event.event}`);
    });
  }

  console.log('\n✨ Demo complete! The suite build ran with Temporal durability.\n');

  console.log('   Key features demonstrated:');
  console.log('   ✓ Multi-phase workflow (INITIALIZE → PLAN → BUILD → VERIFY → COMPLETE)');
  console.log('   ✓ Dependency graph construction with topological sorting');
  console.log('   ✓ Sequential package builds respecting dependencies');
  console.log('   ✓ Durable execution (survives restarts)');
  console.log('   ✓ SuiteBuilderSpec state machine');
  console.log('   ✓ SuiteBuilderOrchestratorAgent coordination');
  console.log('   ✓ State persistence across phases\n');

  console.log('   🔍 View workflow in Temporal Web UI:');
  console.log(`   http://localhost:8233/namespaces/default/workflows/${workflowId}\n`);

  console.log('   📁 Test Suite Structure:');
  console.log('   examples/test-suite/');
  console.log('   ├── master-plan.md');
  console.log('   └── packages/');
  console.log('       ├── package-a/plan.md (no dependencies)');
  console.log('       ├── package-b/plan.md (depends on package-a)');
  console.log('       └── package-c/plan.md (depends on package-b)\n');

  console.log('👋 Done!\n');
}

main().catch((error) => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
