/**
 * Integration test helpers
 * Utilities for compiler-execution integration tests
 */

import { WorkflowClient, Connection } from '@temporalio/client';
import { Worker, NativeConnection, bundleWorkflowCode } from '@temporalio/worker';
import { WorkflowCompiler } from '@/lib/compiler';
import type { WorkflowDefinition } from '@/lib/compiler/types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Check if debug mode is enabled
 */
const isDebugMode = (): boolean => {
  return process.env.WORKFLOW_BUILDER_TEST_DEBUG === '1' || process.env.WORKFLOW_BUILDER_TEST_DEBUG === 'true';
};

/**
 * Get artifacts directory for debug output
 */
function getArtifactsDir(): string {
  const projectRoot = path.join(__dirname, '../../..');
  const artifactsDir = path.join(projectRoot, 'tests', '_artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });
  return artifactsDir;
}

// Test activity implementations
export const testActivities = {
  // Simple success activity
  async sayHello(name: string = 'World'): Promise<string> {
    return `Hello, ${name}!`;
  },

  // Multi-step activities
  async stepOne(input: any): Promise<{ step: number; data: any }> {
    return { step: 1, data: { ...input, step1: 'completed' } };
  },

  async stepTwo(input: any): Promise<{ step: number; data: any }> {
    return { step: 2, data: { ...input, step2: 'completed' } };
  },

  async stepThree(input: any): Promise<{ step: number; data: any }> {
    return { step: 3, data: { ...input, step3: 'completed' } };
  },

  async stepFour(input: any): Promise<{ step: number; data: any }> {
    return { step: 4, data: { ...input, step4: 'completed' } };
  },

  async stepFive(input: any): Promise<{ step: number; data: any }> {
    return { step: 5, data: { ...input, step5: 'completed' } };
  },

  // Flaky activity for retry testing
  async flakyActivity(attemptCount: number = 0): Promise<string> {
    // Fail first 2 attempts, succeed on 3rd
    if (attemptCount < 2) {
      throw new Error(`Attempt ${attemptCount + 1} failed (intentional for retry test)`);
    }
    return `Success after ${attemptCount + 1} attempts`;
  },

  // Slow activity for timeout testing
  async slowActivity(delayMs: number = 5000): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return `Completed after ${delayMs}ms delay`;
  },
};

/**
 * Integration test context for managing Temporal resources
 */
export class IntegrationTestContext {
  private connection: Connection | null = null;
  private client: WorkflowClient | null = null;
  private workers: Worker[] = [];
  private workDirs: string[] = [];
  private workflowTaskQueues: Map<string, string> = new Map(); // workflow name -> task queue
  private startedWorkflows: Set<string> = new Set(); // Track workflow IDs for cleanup

  /**
   * Setup Temporal client connection
   */
  async setup(): Promise<void> {
    // Connect to Temporal (assumes docker-compose is running)
    this.connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    });

    this.client = new WorkflowClient({
      connection: this.connection,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    });
  }

  /**
   * Cleanup all resources
   * Cancels all started workflows before shutting down workers
   */
  async cleanup(): Promise<void> {
    // Cancel all started workflows first
    if (this.client && this.startedWorkflows.size > 0) {
      const cancelPromises = Array.from(this.startedWorkflows).map(async (workflowId) => {
        try {
          const handle = this.client!.getHandle(workflowId);
          // Check if workflow is still running before attempting cancellation
          try {
            const description = await handle.describe();
            // Only cancel if workflow is still running
            if (description.status.name === 'RUNNING') {
              await handle.cancel();
              console.log(`✅ Cancelled workflow: ${workflowId}`);
            }
          } catch (error: any) {
            // Workflow might already be completed or not found - that's okay
            if (!error?.message?.includes('not found') && !error?.message?.includes('completed')) {
              console.warn(`⚠️  Could not cancel workflow ${workflowId}:`, error?.message);
            }
          }
        } catch (error: any) {
          // Log but don't fail cleanup if cancellation fails
          console.warn(`⚠️  Error cancelling workflow ${workflowId}:`, error?.message);
        }
      });

      // Wait for all cancellations with a timeout
      await Promise.allSettled(
        cancelPromises.map(p => 
          Promise.race([
            p,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Cancellation timeout')), 5000)
            )
          ]).catch(() => {}) // Ignore timeout errors
        )
      );
    }

    // Shutdown all workers
    for (const worker of this.workers) {
      try {
        await worker.shutdown();
      } catch (error: any) {
        console.warn('⚠️  Error shutting down worker:', error?.message);
      }
    }
    this.workers = [];

    // Clean up temporary directories (unless in debug mode)
    if (!isDebugMode()) {
      for (const dir of this.workDirs) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }
    } else {
      // In debug mode, log preserved directories
      console.log('🔍 Debug mode: Preserving test workflow directories:');
      for (const dir of this.workDirs) {
        console.log(`  - ${dir}`);
      }
    }
    this.workDirs = [];
    this.workflowTaskQueues.clear();
    this.startedWorkflows.clear();

    // Close connection
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }

    this.client = null;
  }

  /**
   * Get Temporal client
   */
  getClient(): WorkflowClient {
    if (!this.client) {
      throw new Error('Client not initialized. Call setup() first.');
    }
    return this.client;
  }

  /**
   * Compile workflow and register with worker
   */
  async compileAndRegister(
    workflow: WorkflowDefinition,
    options?: { activities?: Record<string, any> }
  ): Promise<{
    workflowCode: string;
    worker: Worker;
    workDir: string;
    taskQueue: string;
  }> {
    // Compile workflow
    const compiler = new WorkflowCompiler({
      includeComments: true,
      strictMode: true,
    });

    const result = compiler.compile(workflow);

    if (!result.success) {
      throw new Error(
        `Compilation failed: ${result.errors?.map(e => e.message).join(', ')}`
      );
    }

    // Create temporary directory for compiled code
    // IMPORTANT: We use a directory within the project (not /tmp) because Temporal's
    // bundler needs access to node_modules and doesn't work properly with directories
    // outside the project structure due to webpack module resolution
    const projectRoot = path.join(__dirname, '../../..');
    const testsOutputDir = path.join(projectRoot, '.test-workflows');
    fs.mkdirSync(testsOutputDir, { recursive: true });

    const workDir = path.join(
      testsOutputDir,
      `test-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    fs.mkdirSync(workDir, { recursive: true });
    this.workDirs.push(workDir);

    // Write compiled code to files in a workflows directory
    // IMPORTANT: We use a 'workflows' directory (not 'src') because Temporal's bundler
    // expects workflowsPath to point to a directory containing workflow files,
    // and it will create the autogenerated-entrypoint.cjs as a sibling to that directory
    //
    // ALSO IMPORTANT: Temporal best practice is to keep workflows and activities in the
    // same directory (but different files), so we put activities.ts IN the workflows dir
    const workflowsDir = path.join(workDir, 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });

    const workflowFile = path.join(workflowsDir, 'index.ts');
    const activitiesFile = path.join(workflowsDir, 'activities.ts');
    const packageJsonFile = path.join(workDir, 'package.json');
    const tsConfigFile = path.join(workDir, 'tsconfig.json');

    fs.writeFileSync(workflowFile, result.workflowCode!);
    fs.writeFileSync(activitiesFile, result.activitiesCode!);
    fs.writeFileSync(packageJsonFile, result.packageJson!);
    fs.writeFileSync(tsConfigFile, result.tsConfig!);

    // Debug mode: Dump workflow code to artifacts directory
    if (isDebugMode()) {
      const artifactsDir = getArtifactsDir();
      const workflowName = workflow.name;
      const artifactFile = path.join(artifactsDir, `${workflowName}-workflows-index.ts`);
      fs.writeFileSync(artifactFile, result.workflowCode!);
      
      // Extract exported function names from workflow code
      const exportedFunctions = extractExportedFunctions(result.workflowCode!);
      
      console.log(`🔍 Debug: Workflow "${workflowName}" (ID: ${workflow.id})`);
      console.log(`  📁 Workflow code: ${artifactFile}`);
      console.log(`  📁 Work directory: ${workDir}`);
      console.log(`  📦 Exported functions: ${exportedFunctions.join(', ')}`);
    }

    // Create native connection for worker
    const nativeConnection = await NativeConnection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    });

    // Merge provided activities with test activities
    const activities = {
      ...testActivities,
      ...(options?.activities || {}),
    };

    // Pre-bundle the workflow code to avoid unionfs/memfs issues in tests
    // This is the recommended approach for integration testing
    const workflowBundle = await bundleWorkflowCode({
      workflowsPath: workflowsDir,
    });

    // Create and start worker with pre-bundled code
    // IMPORTANT: Use a unique task queue per workflow registration to avoid worker isolation issues.
    // When multiple workers share the same task queue, Temporal may route a workflow to a worker
    // that doesn't have that workflow in its bundle, causing "no such function exported" errors.
    // 
    // Strategy:
    // - If workflow explicitly specifies a special queue (e.g., 'test-queue-concurrent'), use it.
    // - If workflow has 'test-queue' (the default) or no queue, generate a unique queue.
    // - This ensures isolation while allowing tests that need shared queues to work correctly.
    const explicitTaskQueue = workflow.settings.taskQueue;
    const isSpecialQueue = explicitTaskQueue && explicitTaskQueue !== 'test-queue';
    const taskQueue = isSpecialQueue
      ? explicitTaskQueue
      : `test-queue-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const worker = await Worker.create({
      connection: nativeConnection,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
      taskQueue,
      workflowBundle,
      activities,
      maxConcurrentActivityTaskExecutions: 10,
      maxConcurrentWorkflowTaskExecutions: 10,
    });

    // Start worker in background
    worker.run().catch(error => {
      console.error('Worker error:', error);
    });

    this.workers.push(worker);
    
    // Store task queue mapping for this workflow
    this.workflowTaskQueues.set(workflow.name, taskQueue);

    return {
      workflowCode: result.workflowCode!,
      worker,
      workDir,
      taskQueue,
    };
  }

  /**
   * Compile and register multiple workflows in a single worker bundle
   * This is needed for concurrency tests where all workflows should share the same task queue
   */
  async compileAndRegisterMultiple(
    workflows: WorkflowDefinition[],
    options?: { 
      activities?: Record<string, any>;
      taskQueue?: string; // If not provided, uses first workflow's taskQueue or generates unique
    }
  ): Promise<{
    workflowCodes: Map<string, string>; // workflow name -> code
    worker: Worker;
    workDir: string;
    taskQueue: string;
  }> {
    if (workflows.length === 0) {
      throw new Error('At least one workflow is required');
    }

    const compiler = new WorkflowCompiler({
      includeComments: true,
      strictMode: true,
    });

    // Compile all workflows
    const compiledWorkflows = workflows.map(workflow => {
      const result = compiler.compile(workflow);
      if (!result.success) {
        throw new Error(
          `Compilation failed for ${workflow.name}: ${result.errors?.map(e => e.message).join(', ')}`
        );
      }
      return { workflow, result };
    });

    // Create temporary directory
    const projectRoot = path.join(__dirname, '../../..');
    const testsOutputDir = path.join(projectRoot, '.test-workflows');
    fs.mkdirSync(testsOutputDir, { recursive: true });

    const workDir = path.join(
      testsOutputDir,
      `test-multi-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    fs.mkdirSync(workDir, { recursive: true });
    this.workDirs.push(workDir);

    const workflowsDir = path.join(workDir, 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });

    // Combine all workflow functions into a single file
    const allImports = new Set<string>();
    const workflowFunctions: string[] = [];
    const workflowCodes = new Map<string, string>();

    for (const { workflow, result } of compiledWorkflows) {
      const code = result.workflowCode!;
      workflowCodes.set(workflow.name, code);

      // Extract imports (lines starting with 'import')
      const importLines = code.split('\n').filter(line => line.trim().startsWith('import'));
      importLines.forEach(imp => allImports.add(imp));

      // Extract workflow function (everything after imports and comments)
      // Find the export async function line and everything after it
      const functionStart = code.indexOf('export async function');
      if (functionStart !== -1) {
        const functionCode = code.substring(functionStart);
        workflowFunctions.push(functionCode);
      }
    }

    // Combine all activities into a single file
    const allActivityCodes: string[] = [];
    const activityImports = new Set<string>();

    for (const { result } of compiledWorkflows) {
      const activitiesCode = result.activitiesCode;
      if (!activitiesCode) continue;
      
      // Extract imports from activities
      const importLines = activitiesCode.split('\n').filter(line => line.trim().startsWith('import'));
      importLines.forEach(imp => activityImports.add(imp));

      // Extract activity functions (everything after imports)
      const functionStart = activitiesCode.indexOf('export async function');
      if (functionStart !== -1) {
        const functionCode = activitiesCode.substring(functionStart);
        allActivityCodes.push(functionCode);
      }
    }

    // Write combined workflow file
    const workflowFile = path.join(workflowsDir, 'index.ts');
    const combinedWorkflowCode = [
      Array.from(allImports).join('\n'),
      '',
      ...workflowFunctions,
    ].join('\n\n');
    fs.writeFileSync(workflowFile, combinedWorkflowCode);

    // Write combined activities file
    const activitiesFile = path.join(workflowsDir, 'activities.ts');
    const combinedActivitiesCode = [
      Array.from(activityImports).join('\n'),
      '',
      ...allActivityCodes,
    ].join('\n\n');
    fs.writeFileSync(activitiesFile, combinedActivitiesCode);

    // Use package.json and tsconfig from first workflow (they should be similar)
    const packageJsonFile = path.join(workDir, 'package.json');
    const tsConfigFile = path.join(workDir, 'tsconfig.json');
    const firstResult = compiledWorkflows[0]?.result;
    if (!firstResult?.packageJson || !firstResult?.tsConfig) {
      throw new Error('First workflow compilation missing package.json or tsconfig.json');
    }
    fs.writeFileSync(packageJsonFile, firstResult.packageJson);
    fs.writeFileSync(tsConfigFile, firstResult.tsConfig);

    // Determine task queue
    const taskQueue = options?.taskQueue || 
                      workflows[0]?.settings?.taskQueue || 
                      `test-queue-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create native connection
    const nativeConnection = await NativeConnection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    });

    // Merge activities
    const activities = {
      ...testActivities,
      ...(options?.activities || {}),
    };

    // Bundle workflow code
    const workflowBundle = await bundleWorkflowCode({
      workflowsPath: workflowsDir,
    });

    // Create and start worker
    const worker = await Worker.create({
      connection: nativeConnection,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
      taskQueue,
      workflowBundle,
      activities,
      maxConcurrentActivityTaskExecutions: 10,
      maxConcurrentWorkflowTaskExecutions: 10,
    });

    worker.run().catch(error => {
      console.error('Worker error:', error);
    });

    this.workers.push(worker);

    // Store task queue mapping for all workflows
    workflows.forEach(workflow => {
      this.workflowTaskQueues.set(workflow.name, taskQueue);
    });

    return {
      workflowCodes,
      worker,
      workDir,
      taskQueue,
    };
  }

  /**
   * Execute workflow and wait for result
   * Automatically tracks workflow for cleanup
   */
  async executeWorkflow<T = any>(
    workflowName: string,
    workflowId: string,
    args: any[] = [],
    options?: {
      taskQueue?: string;
      timeout?: number; // in ms
      workflowExecutionTimeout?: string; // Temporal workflow execution timeout (e.g., '5s')
      trackForCleanup?: boolean; // Whether to track this workflow for automatic cleanup (default: true)
    }
  ): Promise<T> {
    const client = this.getClient();

    // Use provided task queue, or lookup from registered workflows, or fallback to default
    const taskQueue = options?.taskQueue || 
                      this.workflowTaskQueues.get(workflowName) || 
                      'test-queue';

    // Build workflow start options
    const startOptions: any = {
      taskQueue,
      workflowId,
      args,
    };

    // Add workflow execution timeout if specified
    if (options?.workflowExecutionTimeout) {
      startOptions.workflowExecutionTimeout = options.workflowExecutionTimeout;
    }

    const handle = await client.start(workflowName, startOptions);

    // Track workflow for cleanup (unless explicitly disabled)
    if (options?.trackForCleanup !== false) {
      this.startedWorkflows.add(workflowId);
    }

    // Wait for result with timeout
    const timeoutMs = options?.timeout || 30000; // Default 30 seconds
    const resultPromise = handle.result();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Workflow execution timeout')), timeoutMs)
    );

    try {
      const result = await Promise.race([resultPromise, timeoutPromise]) as T;
      // Remove from tracking if completed successfully
      this.startedWorkflows.delete(workflowId);
      return result;
    } catch (error) {
      // Keep in tracking if it failed (might still be running)
      // Cleanup will handle cancellation
      throw error;
    }
  }

  /**
   * Validate TypeScript code compiles
   */
  async validateTypeScript(code: string, workDir: string): Promise<boolean> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const testFile = path.join(workDir, 'validate.ts');
    fs.writeFileSync(testFile, code);

    try {
      // Run tsc with noEmit flag
      await execAsync(
        `npx tsc --noEmit --skipLibCheck --strict ${testFile}`,
        { cwd: workDir }
      );
      return true;
    } catch (error) {
      console.error('TypeScript validation failed:', error);
      return false;
    }
  }

  /**
   * Get workflow execution history
   */
  async getWorkflowHistory(workflowId: string): Promise<any> {
    const client = this.getClient();
    const handle = client.getHandle(workflowId);
    const history = await handle.fetchHistory();
    return history;
  }

  /**
   * Cancel workflow execution
   * Also removes from tracking if it was being tracked
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    const client = this.getClient();
    const handle = client.getHandle(workflowId);
    await handle.cancel();
    // Remove from tracking since we've explicitly cancelled it
    this.startedWorkflows.delete(workflowId);
  }

  /**
   * Manually track a workflow ID for cleanup
   * Useful when workflows are started outside of executeWorkflow
   */
  trackWorkflow(workflowId: string): void {
    this.startedWorkflows.add(workflowId);
  }

  /**
   * Manually untrack a workflow ID
   * Useful when a workflow is known to be completed
   */
  untrackWorkflow(workflowId: string): void {
    this.startedWorkflows.delete(workflowId);
  }

  /**
   * Get list of tracked workflow IDs
   */
  getTrackedWorkflows(): string[] {
    return Array.from(this.startedWorkflows);
  }

  /**
   * Wait for worker to be ready
   */
  async waitForWorkerReady(timeoutMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      // Check if any worker has polled tasks
      if (this.workers.length > 0) {
        // Give workers time to register
        await new Promise(resolve => setTimeout(resolve, 1000));
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Worker not ready within timeout');
  }
}

/**
 * Generate unique workflow ID for testing
 */
export function generateWorkflowId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Sleep helper for tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts - 1) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Extract exported function names from workflow code
 */
function extractExportedFunctions(code: string): string[] {
  const functions: string[] = [];
  // Match: export async function FunctionName(...)
  const regex = /export\s+async\s+function\s+(\w+)\s*\(/g;
  let match;
  while ((match = regex.exec(code)) !== null) {
    if (match[1]) {
      functions.push(match[1]);
    }
  }
  return functions;
}

/**
 * Write history summary to artifacts directory (debug mode)
 */
export async function writeHistorySummary(
  workflowId: string,
  history: any,
  testName: string
): Promise<void> {
  if (!isDebugMode()) {
    return;
  }

  const artifactsDir = getArtifactsDir();
  const summaryFile = path.join(artifactsDir, `${testName}-${workflowId}-history.json`);
  
  // Extract first N events with key information
  const events = (history.events || []).slice(0, 20).map((event: any) => {
    const eventType = event.eventType;
    const attrs = event[`${eventType}EventAttributes`] || {};
    
    return {
      eventId: event.eventId,
      eventType,
      timestamp: event.eventTime,
      // Include timeout/failure attributes if present
      timeoutInfo: attrs.timeoutInfo || null,
      failure: attrs.failure ? {
        message: attrs.failure.message,
        failureType: attrs.failure.failureType,
      } : null,
    };
  });

  const summary = {
    workflowId,
    testName,
    totalEvents: history.events?.length || 0,
    firstEvents: events,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`🔍 Debug: History summary written to ${summaryFile}`);
}
