/**
 * Create Package Management Workflows
 * 
 * Creates a "Package Management" project and workflows for test@example.com
 * representing the complex workflow patterns from the package builder system.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createPackageManagementWorkflows() {
  console.log('📦 Creating Package Management Workflows\n');

  // Step 1: Find test@example.com user
  console.log('1️⃣ Finding test@example.com user...');
  
  // Query users table directly (auth_user_id should match auth.users.id)
  const { data: userRecord } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'test@example.com')
    .single();

  if (!userRecord) {
    console.error('❌ test@example.com user not found!');
    console.log('\nPlease create the user first:');
    console.log('  1. Run migrations to create test user');
    console.log('  2. Or create via Supabase Auth UI');
    console.log('  3. Then run this script again\n');
    process.exit(1);
  }

  console.log(`   ✅ Found user: ${userRecord.email} (ID: ${userRecord.id})`);

  // Step 2: Get reference IDs
  console.log('\n2️⃣ Getting reference data...');
  
  const { data: privateVisibility } = await supabase
    .from('component_visibility')
    .select('id')
    .eq('name', 'private')
    .single();

  const { data: draftStatus } = await supabase
    .from('workflow_statuses')
    .select('id')
    .eq('name', 'draft')
    .single();

  if (!privateVisibility || !draftStatus) {
    console.error('❌ Missing required reference data');
    process.exit(1);
  }

  console.log('   ✅ Got reference IDs');

  // Step 3: Create Package Management Project
  console.log('\n3️⃣ Creating Package Management project...');
  
  const projectKebab = 'package-management';
  const userIdPrefix = userRecord.id.split('-')[0];
  const taskQueueName = `${userIdPrefix}-${projectKebab}-queue`;

  // Check if project already exists
  const { data: existingProject } = await supabase
    .from('projects')
    .select('*')
    .eq('created_by', userRecord.id)
    .eq('name', 'Package Management')
    .single();

  let project;
  let taskQueue;

  if (existingProject) {
    console.log('   ℹ️  Project already exists, using existing...');
    project = existingProject;
    
    // Get task queue
    const { data: tq } = await supabase
      .from('task_queues')
      .select('*')
      .eq('name', project.task_queue_name)
      .single();
    taskQueue = tq;
  } else {
    // Create project
    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: 'Package Management',
        description: 'Workflows for managing package builds, dependencies, and continuous integration',
        created_by: userRecord.id,
        task_queue_name: taskQueueName,
        is_active: true,
      })
      .select()
      .single();

    if (projectError) {
      console.error('❌ Error creating project:', projectError);
      process.exit(1);
    }

    project = newProject;
    console.log(`   ✅ Created project: ${project.name} (ID: ${project.id})`);

    // Create task queue
    const { data: newTaskQueue, error: queueError } = await supabase
      .from('task_queues')
      .insert({
        name: taskQueueName,
        display_name: 'Package Management Task Queue',
        description: 'Task queue for package management workflows',
        created_by: userRecord.id,
      })
      .select()
      .single();

    if (queueError) {
      console.error('❌ Error creating task queue:', queueError);
      // Try to get existing queue
      const { data: tq } = await supabase
        .from('task_queues')
        .select('*')
        .eq('name', taskQueueName)
        .single();
      taskQueue = tq;
    } else {
      taskQueue = newTaskQueue;
      console.log(`   ✅ Created task queue: ${taskQueue.name}`);
    }
  }

  if (!taskQueue) {
    console.error('❌ Task queue not found');
    process.exit(1);
  }

  // Step 4: Create workflows
  console.log('\n4️⃣ Creating workflows...\n');

  const workflows = [
    {
      kebabName: 'package-builder',
      displayName: 'Package Builder',
      description: 'Multi-phase workflow that orchestrates building multiple packages with dependency-aware scheduling. Spawns child workflows up to maxConcurrentBuilds limit.',
      definition: createPackageBuilderDefinition(),
    },
    {
      kebabName: 'package-build',
      displayName: 'Package Build',
      description: 'Single package build workflow with pre-flight validation, conditional logic, retry loops, and agent-driven remediation.',
      definition: createPackageBuildDefinition(),
    },
    {
      kebabName: 'continuous-builder',
      displayName: 'Continuous Builder',
      description: 'Long-running orchestrator that manages build queue, spawns child workflows, handles retries with exponential backoff, and supports control signals.',
      definition: createContinuousBuilderDefinition(),
    },
    {
      kebabName: 'mcp-poller',
      displayName: 'MCP Poller',
      description: 'Cron-scheduled workflow that queries MCP for packages ready to build and signals the orchestrator.',
      definition: createMCPPollerDefinition(),
    },
  ];

  for (const workflow of workflows) {
    // Check if workflow already exists
    const { data: existing } = await supabase
      .from('workflows')
      .select('id')
      .eq('kebab_name', workflow.kebabName)
      .eq('created_by', userRecord.id)
      .single();

    if (existing) {
      console.log(`   ℹ️  Workflow "${workflow.displayName}" already exists, skipping...`);
      continue;
    }

    const { data: newWorkflow, error: workflowError } = await supabase
      .from('workflows')
      .insert({
        kebab_name: workflow.kebabName,
        display_name: workflow.displayName,
        description: workflow.description,
        created_by: userRecord.id,
        visibility_id: privateVisibility.id,
        status_id: draftStatus.id,
        task_queue_id: taskQueue.id,
        project_id: project.id,
        definition: workflow.definition,
      })
      .select()
      .single();

    if (workflowError) {
      console.error(`   ❌ Error creating workflow "${workflow.displayName}":`, workflowError.message);
    } else {
      console.log(`   ✅ Created workflow: ${workflow.displayName}`);
    }
  }

  console.log('\n✅ Package Management workflows created successfully!\n');
  console.log('📋 Summary:');
  console.log(`   Project: ${project.name}`);
  console.log(`   Task Queue: ${taskQueue.name}`);
  console.log(`   Workflows: ${workflows.length}`);
  console.log('\n🌐 View in UI:');
  console.log(`   http://localhost:3010/projects/${project.id}\n`);
}

/**
 * PackageBuilderWorkflow definition
 * Multi-phase workflow with dependency-aware concurrent child spawning
 * Matches: packages/agents/package-builder-production/src/workflows/package-builder.workflow.ts
 */
function createPackageBuilderDefinition() {
  return {
    nodes: [
      {
        id: 'start',
        type: 'trigger',
        position: { x: 100, y: 100 },
        data: { label: 'Start' },
      },
      {
        id: 'init-state',
        type: 'state-variable',
        position: { x: 300, y: 50 },
        data: {
          label: 'Initialize State',
          config: {
            name: 'state',
            operation: 'set',
            value: {
              phase: 'PLAN',
              buildId: 'input.buildId',
              packages: [],
              completedPackages: [],
              failedPackages: [],
              childWorkflowIds: 'new Map()',
            },
            scope: 'workflow',
          },
        },
      },
      {
        id: 'phase-initialize',
        type: 'phase',
        position: { x: 300, y: 150 },
        data: {
          label: 'INITIALIZE',
          config: {
            name: 'INITIALIZE',
            description: 'Parse audit report and build dependency graph',
            sequential: true,
          },
        },
      },
      {
        id: 'build-dependency-graph',
        type: 'activity',
        position: { x: 500, y: 150 },
        data: {
          label: 'Build Dependency Graph',
          componentName: 'buildDependencyGraph',
          config: {
            activityName: 'buildDependencyGraph',
          },
        },
      },
      {
        id: 'update-state-packages',
        type: 'state-variable',
        position: { x: 700, y: 150 },
        data: {
          label: 'Update State Packages',
          config: {
            name: 'state',
            operation: 'set',
            value: 'result.packages',
            scope: 'workflow',
          },
        },
      },
      {
        id: 'phase-plan',
        type: 'phase',
        position: { x: 300, y: 250 },
        data: {
          label: 'PLAN',
          config: {
            name: 'PLAN',
            description: 'Verify package plans exist',
            sequential: true,
          },
        },
      },
      {
        id: 'verify-plans',
        type: 'activity',
        position: { x: 500, y: 250 },
        data: {
          label: 'Verify Plans',
          componentName: 'verifyPlans',
        },
      },
      {
        id: 'phase-build',
        type: 'phase',
        position: { x: 300, y: 350 },
        data: {
          label: 'BUILD',
          config: {
            name: 'BUILD',
            description: 'Spawn parallel child workflows (respecting dependencies)',
            sequential: false,
            maxConcurrency: 4,
          },
        },
      },
      {
        id: 'build-loop',
        type: 'activity',
        position: { x: 500, y: 350 },
        data: {
          label: 'Build Loop',
          componentName: 'buildPhaseLoop',
          config: {
            description: 'While hasUnbuiltPackages: spawn children with Promise.race()',
            maxConcurrent: 4,
          },
        },
      },
      {
        id: 'spawn-package-build',
        type: 'child-workflow',
        position: { x: 700, y: 350 },
        data: {
          label: 'Spawn PackageBuildWorkflow',
          componentName: 'PackageBuildWorkflow',
          config: {
            workflowType: 'PackageBuildWorkflow',
            taskQueue: 'engine',
            inputMapping: {
              packageName: 'pkg.name',
              packagePath: 'pkg.path',
              planPath: 'pkg.planPath',
              category: 'pkg.category',
              dependencies: 'pkg.dependencies',
              workspaceRoot: 'input.workspaceRoot',
              config: 'input.config',
            },
          },
        },
      },
      {
        id: 'phase-verify',
        type: 'phase',
        position: { x: 300, y: 450 },
        data: {
          label: 'VERIFY',
          config: {
            name: 'VERIFY',
            description: 'Run integration tests',
            sequential: true,
          },
        },
      },
      {
        id: 'run-integration-tests',
        type: 'activity',
        position: { x: 500, y: 450 },
        data: {
          label: 'Run Integration Tests',
          componentName: 'runIntegrationTests',
        },
      },
      {
        id: 'phase-complete',
        type: 'phase',
        position: { x: 300, y: 550 },
        data: {
          label: 'COMPLETE',
          config: {
            name: 'COMPLETE',
            description: 'Generate aggregate reports',
            sequential: true,
          },
        },
      },
      {
        id: 'load-package-reports',
        type: 'activity',
        position: { x: 500, y: 550 },
        data: {
          label: 'Load All Package Reports',
          componentName: 'loadAllPackageReports',
        },
      },
      {
        id: 'write-build-report',
        type: 'activity',
        position: { x: 700, y: 550 },
        data: {
          label: 'Write Build Report',
          componentName: 'writeBuildReport',
        },
      },
      {
        id: 'end',
        type: 'trigger',
        position: { x: 900, y: 550 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'init-state' },
      { id: 'e2', source: 'init-state', target: 'phase-initialize' },
      { id: 'e3', source: 'phase-initialize', target: 'build-dependency-graph' },
      { id: 'e4', source: 'build-dependency-graph', target: 'update-state-packages' },
      { id: 'e5', source: 'update-state-packages', target: 'phase-plan' },
      { id: 'e6', source: 'phase-plan', target: 'verify-plans' },
      { id: 'e7', source: 'verify-plans', target: 'phase-build' },
      { id: 'e8', source: 'phase-build', target: 'build-loop' },
      { id: 'e9', source: 'build-loop', target: 'spawn-package-build' },
      { id: 'e10', source: 'spawn-package-build', target: 'phase-verify' },
      { id: 'e11', source: 'phase-verify', target: 'run-integration-tests' },
      { id: 'e12', source: 'run-integration-tests', target: 'phase-complete' },
      { id: 'e13', source: 'phase-complete', target: 'load-package-reports' },
      { id: 'e14', source: 'load-package-reports', target: 'write-build-report' },
      { id: 'e15', source: 'write-build-report', target: 'end' },
    ],
  };
}

/**
 * PackageBuildWorkflow definition
 * Single package build with conditional logic and retry loops
 * Matches: packages/agents/package-builder-production/src/workflows/package-build.workflow.ts
 */
function createPackageBuildDefinition() {
  return {
    nodes: [
      {
        id: 'start',
        type: 'trigger',
        position: { x: 100, y: 200 },
        data: { label: 'Start' },
      },
      {
        id: 'init-report',
        type: 'state-variable',
        position: { x: 300, y: 100 },
        data: {
          label: 'Initialize Report',
          config: {
            name: 'report',
            operation: 'set',
            value: {
              packageName: 'input.packageName',
              startTime: 'new Date().toISOString()',
              status: 'success',
              fixAttempts: '[]',
            },
            scope: 'workflow',
          },
        },
      },
      {
        id: 'check-package-exists',
        type: 'activity',
        position: { x: 300, y: 200 },
        data: {
          label: 'Check Package Exists',
          componentName: 'checkPackageExists',
        },
      },
      {
        id: 'condition-code-exists',
        type: 'condition',
        position: { x: 500, y: 200 },
        data: {
          label: 'Code Exists?',
          config: {
            expression: 'result.codeExists === true',
          },
        },
      },
      {
        id: 'check-npm-published',
        type: 'activity',
        position: { x: 700, y: 150 },
        data: {
          label: 'Check NPM Published',
          componentName: 'checkNpmPublished',
        },
      },
      {
        id: 'condition-published',
        type: 'condition',
        position: { x: 900, y: 150 },
        data: {
          label: 'Published?',
          config: {
            expression: 'result.published === true',
          },
        },
      },
      {
        id: 'check-upgrade-plan',
        type: 'activity',
        position: { x: 1100, y: 100 },
        data: {
          label: 'Check Upgrade Plan',
          componentName: 'checkIfUpgradePlan',
        },
      },
      {
        id: 'condition-upgrade',
        type: 'condition',
        position: { x: 1300, y: 100 },
        data: {
          label: 'Upgrade Plan?',
          config: {
            expression: 'result.isUpgrade === true',
          },
        },
      },
      {
        id: 'audit-upgrade',
        type: 'activity',
        position: { x: 1500, y: 50 },
        data: {
          label: 'Audit Package Upgrade',
          componentName: 'auditPackageUpgrade',
        },
      },
      {
        id: 'update-mcp-published',
        type: 'activity',
        position: { x: 1100, y: 200 },
        data: {
          label: 'Update MCP Status (Published)',
          componentName: 'updateMCPPackageStatus',
        },
      },
      {
        id: 'early-exit',
        type: 'trigger',
        position: { x: 1300, y: 200 },
        data: { label: 'Early Exit (Published)' },
      },
      {
        id: 'audit-state',
        type: 'activity',
        position: { x: 700, y: 300 },
        data: {
          label: 'Audit Package State',
          componentName: 'auditPackageState',
        },
      },
      {
        id: 'verify-deps',
        type: 'activity',
        position: { x: 500, y: 400 },
        data: {
          label: 'Verify Dependencies',
          componentName: 'verifyDependencies',
        },
      },
      {
        id: 'load-agent-registry',
        type: 'activity',
        position: { x: 700, y: 400 },
        data: {
          label: 'Load Agent Registry',
          componentName: 'loadAgentRegistry',
        },
      },
      {
        id: 'scaffold-coordinator',
        type: 'child-workflow',
        position: { x: 900, y: 400 },
        data: {
          label: 'Scaffold via Coordinator',
          componentName: 'CoordinatorWorkflow',
          config: {
            workflowType: 'CoordinatorWorkflow',
            taskQueue: 'engine',
            executionType: 'executeChild', // Use executeChild, not startChild
            inputMapping: {
              problem: 'scaffoldProblem',
              agentRegistry: 'agentRegistry',
              maxAttempts: '1',
              workspaceRoot: 'input.workspaceRoot',
            },
          },
        },
      },
      {
        id: 'commit-scaffold',
        type: 'activity',
        position: { x: 1100, y: 400 },
        data: {
          label: 'Commit Scaffold',
          componentName: 'commitChanges',
        },
      },
      {
        id: 'run-build',
        type: 'activity',
        position: { x: 1300, y: 400 },
        data: {
          label: 'Run Build',
          componentName: 'runBuild',
        },
      },
      {
        id: 'build-retry-loop',
        type: 'retry',
        position: { x: 1500, y: 400 },
        data: {
          label: 'Build Retry Loop',
          config: {
            maxAttempts: 3,
            retryOn: 'failure',
            backoff: {
              type: 'exponential',
              initialInterval: '1s',
            },
            scope: 'block',
            coordinatorWorkflow: 'CoordinatorWorkflow',
            problemType: 'BUILD_FAILURE',
          },
        },
      },
      {
        id: 'run-tests',
        type: 'activity',
        position: { x: 1700, y: 400 },
        data: {
          label: 'Run Tests',
          componentName: 'runTests',
        },
      },
      {
        id: 'test-retry-loop',
        type: 'retry',
        position: { x: 1900, y: 400 },
        data: {
          label: 'Test Retry Loop',
          config: {
            maxAttempts: 3,
            retryOn: 'failure',
            backoff: {
              type: 'exponential',
              initialInterval: '1s',
            },
            scope: 'block',
            coordinatorWorkflow: 'CoordinatorWorkflow',
            problemType: 'TEST_FAILURE',
          },
        },
      },
      {
        id: 'run-quality-checks',
        type: 'activity',
        position: { x: 2100, y: 400 },
        data: {
          label: 'Run Quality Checks',
          componentName: 'runQualityChecks',
        },
      },
      {
        id: 'quality-retry-loop',
        type: 'retry',
        position: { x: 2300, y: 400 },
        data: {
          label: 'Quality Retry Loop',
          config: {
            maxAttempts: 3,
            retryOn: 'failure',
            backoff: {
              type: 'none',
            },
            scope: 'block',
            fixAgentActivity: 'spawnFixAgent',
          },
        },
      },
      {
        id: 'publish-package',
        type: 'activity',
        position: { x: 2500, y: 400 },
        data: {
          label: 'Publish Package',
          componentName: 'publishPackage',
        },
      },
      {
        id: 'push-changes',
        type: 'activity',
        position: { x: 2700, y: 400 },
        data: {
          label: 'Push Changes',
          componentName: 'pushChanges',
        },
      },
      {
        id: 'write-report',
        type: 'activity',
        position: { x: 2900, y: 400 },
        data: {
          label: 'Write Package Report',
          componentName: 'writePackageBuildReport',
        },
      },
      {
        id: 'end',
        type: 'trigger',
        position: { x: 3100, y: 400 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'init-report' },
      { id: 'e2', source: 'init-report', target: 'check-package-exists' },
      { id: 'e3', source: 'check-package-exists', target: 'condition-code-exists' },
      { id: 'e4', source: 'condition-code-exists', target: 'check-npm-published', sourceHandle: 'true' },
      { id: 'e5', source: 'condition-code-exists', target: 'verify-deps', sourceHandle: 'false' },
      { id: 'e6', source: 'check-npm-published', target: 'condition-published' },
      { id: 'e7', source: 'condition-published', target: 'check-upgrade-plan', sourceHandle: 'true' },
      { id: 'e8', source: 'condition-published', target: 'audit-state', sourceHandle: 'false' },
      { id: 'e9', source: 'check-upgrade-plan', target: 'condition-upgrade' },
      { id: 'e10', source: 'condition-upgrade', target: 'audit-upgrade', sourceHandle: 'true' },
      { id: 'e11', source: 'condition-upgrade', target: 'update-mcp-published', sourceHandle: 'false' },
      { id: 'e12', source: 'update-mcp-published', target: 'early-exit' },
      { id: 'e13', source: 'audit-upgrade', target: 'verify-deps' },
      { id: 'e14', source: 'audit-state', target: 'verify-deps' },
      { id: 'e15', source: 'verify-deps', target: 'load-agent-registry' },
      { id: 'e16', source: 'load-agent-registry', target: 'scaffold-coordinator' },
      { id: 'e17', source: 'scaffold-coordinator', target: 'commit-scaffold' },
      { id: 'e18', source: 'commit-scaffold', target: 'run-build' },
      { id: 'e19', source: 'run-build', target: 'build-retry-loop' },
      { id: 'e20', source: 'build-retry-loop', target: 'run-tests' },
      { id: 'e21', source: 'run-tests', target: 'test-retry-loop' },
      { id: 'e22', source: 'test-retry-loop', target: 'run-quality-checks' },
      { id: 'e23', source: 'run-quality-checks', target: 'quality-retry-loop' },
      { id: 'e24', source: 'quality-retry-loop', target: 'publish-package' },
      { id: 'e25', source: 'publish-package', target: 'push-changes' },
      { id: 'e26', source: 'push-changes', target: 'write-report' },
      { id: 'e27', source: 'write-report', target: 'end' },
    ],
  };
}

/**
 * ContinuousBuilderWorkflow definition
 * Long-running orchestrator with signals and queue management
 */
function createContinuousBuilderDefinition() {
  return {
    nodes: [
      {
        id: 'start',
        type: 'trigger',
        position: { x: 100, y: 300 },
        data: { label: 'Start' },
      },
      {
        id: 'init-state',
        type: 'activity',
        position: { x: 300, y: 300 },
        data: {
          label: 'Initialize State',
          componentName: 'Initialize Orchestrator State',
          config: {
            description: 'Initialize internal queue, active builds map, retry tracking',
          },
        },
      },
      {
        id: 'setup-signals',
        type: 'signal',
        position: { x: 500, y: 200 },
        data: {
          label: 'Setup Signal Handlers',
          signalName: 'newPackages',
          config: {
            description: 'Handle newPackages, pause, resume, drain, emergencyStop signals',
          },
        },
      },
      {
        id: 'main-loop',
        type: 'activity',
        position: { x: 700, y: 300 },
        data: {
          label: 'Main Loop',
          componentName: 'Orchestration Loop',
          config: {
            description: 'Long-running loop: spawn builds, handle completions, check continue-as-new',
            maxConcurrent: 4,
            continueAsNewThreshold: 100,
            continueAsNewTimeLimit: '24h',
          },
        },
      },
      {
        id: 'spawn-builds',
        type: 'child-workflow',
        position: { x: 900, y: 300 },
        data: {
          label: 'Spawn Builds',
          componentName: 'Spawn Package Builds',
          config: {
            workflowType: 'package-build',
            maxConcurrent: 4,
            completionStrategy: 'race',
          },
        },
      },
      {
        id: 'handle-completion',
        type: 'activity',
        position: { x: 1100, y: 300 },
        data: {
          label: 'Handle Completion',
          componentName: 'Process Build Result',
          config: {
            description: 'Update MCP status, handle retries with exponential backoff',
            maxRetries: 3,
          },
        },
      },
      {
        id: 'end',
        type: 'trigger',
        position: { x: 1300, y: 300 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'init-state' },
      { id: 'e2', source: 'init-state', target: 'setup-signals' },
      { id: 'e3', source: 'setup-signals', target: 'main-loop' },
      { id: 'e4', source: 'main-loop', target: 'spawn-builds' },
      { id: 'e5', source: 'spawn-builds', target: 'handle-completion' },
      { id: 'e6', source: 'handle-completion', target: 'main-loop' },
      { id: 'e7', source: 'main-loop', target: 'end', sourceHandle: 'exit' },
    ],
  };
}

/**
 * MCPPollerWorkflow definition
 * Cron-scheduled workflow
 */
function createMCPPollerDefinition() {
  return {
    nodes: [
      {
        id: 'start',
        type: 'trigger',
        position: { x: 100, y: 400 },
        data: {
          label: 'Start (Cron)',
          config: {
            cronSchedule: '0 */30 * * *',
            description: 'Runs every 30 minutes',
          },
        },
      },
      {
        id: 'query-mcp',
        type: 'activity',
        position: { x: 300, y: 400 },
        data: {
          label: 'Query MCP',
          componentName: 'Query MCP for Packages',
          config: {
            description: 'Query MCP build queue for packages ready to build',
            limit: 10,
          },
        },
      },
      {
        id: 'signal-orchestrator',
        type: 'signal',
        position: { x: 500, y: 400 },
        data: {
          label: 'Signal Orchestrator',
          signalName: 'newPackages',
          config: {
            description: 'Signal ContinuousBuilderWorkflow with new packages',
            targetWorkflow: 'continuous-builder',
          },
        },
      },
      {
        id: 'end',
        type: 'trigger',
        position: { x: 700, y: 400 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'query-mcp' },
      { id: 'e2', source: 'query-mcp', target: 'signal-orchestrator' },
      { id: 'e3', source: 'signal-orchestrator', target: 'end' },
    ],
  };
}

// Run the script
createPackageManagementWorkflows()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

