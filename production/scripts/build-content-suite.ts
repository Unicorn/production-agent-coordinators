import { Connection, Client } from '@temporalio/client';
import { SuiteBuilderWorkflow } from '@coordinator/agent-suite-builder-production';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Load configuration
  const configPath = path.join(__dirname, '../configs/build-env.json');

  if (!fs.existsSync(configPath)) {
    console.error('❌ Configuration file not found:', configPath);
    console.error('Please copy example-build-env.json to build-env.json and add your credentials');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Validate audit report exists
  const auditReportPath = '/Users/mattbernier/projects/tools/audit-report-content-management-suite.json';

  if (!fs.existsSync(auditReportPath)) {
    console.error('❌ Audit report not found:', auditReportPath);
    process.exit(1);
  }

  console.log('🚀 Starting Production Suite Builder');
  console.log('Suite: content-management-suite');
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

  // Start workflow
  const handle = await client.workflow.start(SuiteBuilderWorkflow, {
    taskQueue: config.temporal.taskQueue,
    workflowId: `suite-builder-content-management-${Date.now()}`,
    args: [{
      suiteId: 'content-management-suite',
      auditReportPath,
      config
    }]
  });

  console.log(`Workflow started: ${handle.workflowId}`);
  console.log('Waiting for completion...');
  console.log('');

  // Wait for result
  try {
    await handle.result();
    console.log('');
    console.log('✅ Suite build completed successfully!');
    console.log('');
    console.log('Reports available at:');
    console.log(`  ${config.workspaceRoot}/production/reports/${new Date().toISOString().split('T')[0]}/`);
  } catch (error) {
    console.error('');
    console.error('❌ Suite build failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
