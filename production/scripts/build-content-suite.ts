import { Connection, Client } from '@temporalio/client';
import { SuiteBuilderWorkflow } from '@coordinator/agent-suite-builder-production';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Parse command-line arguments for minimal input
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Missing input argument');
    console.error('');
    console.error('Usage:');
    console.error('  yarn workflow:run <package-name>          - Build package by name');
    console.error('  yarn workflow:run <package-idea>          - Build package by idea description');
    console.error('  yarn workflow:run <plan-file-path>        - Build package from plan file');
    console.error('  yarn workflow:run --update <package-name> <prompt> - Update package with prompt');
    console.error('');
    console.error('Examples:');
    console.error('  yarn workflow:run openai-client');
    console.error('  yarn workflow:run "@bernierllc/openai-client"');
    console.error('  yarn workflow:run "create streaming OpenAI client"');
    console.error('  yarn workflow:run plans/packages/core/openai-client.md');
    console.error('  yarn workflow:run --update openai-client "add streaming support"');
    process.exit(1);
  }

  // Determine input type
  let packageName: string | undefined;
  let packageIdea: string | undefined;
  let planFilePath: string | undefined;
  let updatePrompt: string | undefined;

  if (args[0] === '--update') {
    if (args.length < 3) {
      console.error('❌ --update requires package name and update prompt');
      process.exit(1);
    }
    packageName = args[1];
    updatePrompt = args[2];
  } else {
    const input = args[0];

    // Detect input type
    if (input.endsWith('.md')) {
      planFilePath = input;
    } else if (input.includes('@') || input.includes('/')) {
      packageName = input;
    } else if (input.includes(' ') || input.length > 30) {
      packageIdea = input;
    } else {
      packageName = input;
    }
  }

  // Load configuration
  const configPath = path.join(__dirname, '../configs/build-env.json');

  if (!fs.existsSync(configPath)) {
    console.error('❌ Configuration file not found:', configPath);
    console.error('Please copy example-build-env.json to build-env.json and add your credentials');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  console.log('🚀 Starting Autonomous Package Workflow');
  if (packageName) console.log(`Package Name: ${packageName}`);
  if (packageIdea) console.log(`Package Idea: ${packageIdea}`);
  if (planFilePath) console.log(`Plan File: ${planFilePath}`);
  if (updatePrompt) console.log(`Update Prompt: ${updatePrompt}`);
  console.log(`Workspace: ${config.workspaceRoot}`);
  console.log(`Max Concurrent Builds: ${config.maxConcurrentBuilds}`);
  console.log('');

  // Connect to Temporal
  const connection = await Connection.connect({
    address: config.temporal.address
  });

  const client = new Client({
    connection,
    namespace: config.temporal.namespace
  });

  // Start workflow with minimal input
  const workflowId = packageName
    ? `package-build-${packageName.replace(/[@/]/g, '-')}-${Date.now()}`
    : `package-build-${Date.now()}`;

  const handle = await client.workflow.start(SuiteBuilderWorkflow, {
    taskQueue: config.temporal.taskQueue,
    workflowId,
    args: [{
      packageName,
      packageIdea,
      planFilePath,
      updatePrompt,
      config
    }]
  });

  console.log(`Workflow started: ${handle.workflowId}`);
  console.log('Waiting for completion...');
  console.log('');

  // Wait for result
  try {
    const result = await handle.result();
    console.log('');
    console.log('✅ Package workflow completed successfully!');
    console.log('');
    console.log('Summary:');
    console.log(`  Total Packages: ${result.totalPackages}`);
    console.log(`  Successful Builds: ${result.successfulBuilds}`);
    console.log(`  Failed Builds: ${result.failedBuilds}`);
    console.log(`  Skipped: ${result.skippedPackages}`);
    console.log('');
    console.log('Reports available at:');
    console.log(`  ${config.workspaceRoot}/production/reports/${new Date().toISOString().split('T')[0]}/`);
  } catch (error) {
    console.error('');
    console.error('❌ Package workflow failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
