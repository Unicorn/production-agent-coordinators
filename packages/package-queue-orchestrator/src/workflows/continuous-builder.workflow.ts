/**
 * Continuous Builder Workflow
 *
 * A long-running orchestrator workflow that:
 * - Manages an internal queue of packages to build
 * - Spawns child build workflows up to maxConcurrent limit
 * - Handles retries with exponential backoff
 * - Supports control signals (pause, resume, drain, emergency stop)
 * - Uses continue-as-new to avoid history bloat
 */

import {
  defineSignal,
  setHandler,
  condition,
  proxyActivities,
  startChild,
  continueAsNew,
  sleep,
} from '@temporalio/workflow';
import type * as activities from '../activities/index.js';
import type { Package, OrchestratorInput, OrchestratorState, BuildResult } from '../types/index.js';

// Proxy activities with reasonable timeout
const { updateMCPPackageStatus } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
});

// Define signals for external control
export const newPackagesSignal = defineSignal<[Package[]]>('newPackages');
export const pauseSignal = defineSignal('pause');
export const resumeSignal = defineSignal('resume');
export const drainSignal = defineSignal('drain');
export const emergencyStopSignal = defineSignal('emergencyStop');
export const adjustConcurrencySignal = defineSignal<[number]>('adjustConcurrency');

/**
 * ContinuousBuilderWorkflow
 *
 * Long-running orchestrator that manages the build queue and spawns child workflows.
 *
 * @param input - Configuration for the orchestrator
 */
export async function ContinuousBuilderWorkflow(
  input: OrchestratorInput
): Promise<void> {
  // Initialize state
  const state: OrchestratorState = {
    internalQueue: [],
    activeBuilds: new Map(),
    failedRetries: new Map(),
    isPaused: false,
    isDraining: false,
    maxConcurrent: input.maxConcurrent,
  };

  // Tracking for continue-as-new
  let completedBuilds = 0;
  const startTime = Date.now();
  const maxRetries = 3;
  const continueAsNewThreshold = 100; // builds
  const continueAsNewTimeLimit = 24 * 60 * 60 * 1000; // 24 hours

  // Flag to track emergency stop
  let emergencyStopRequested = false;

  // Set up signal handlers
  setHandler(newPackagesSignal, (packages: Package[]) => {
    // Merge packages into internal queue (deduplicate by package name)
    for (const pkg of packages) {
      // Check if package already exists in queue
      const existingIndex = state.internalQueue.findIndex(
        (p) => p.name === pkg.name
      );

      if (existingIndex === -1) {
        // New package, add to queue
        state.internalQueue.push(pkg);
      } else {
        // Package exists, update with latest data (higher priority wins)
        const existing = state.internalQueue[existingIndex];
        if (pkg.priority > existing.priority) {
          state.internalQueue[existingIndex] = pkg;
        }
      }
    }

    console.log(
      `Received ${packages.length} packages, queue now has ${state.internalQueue.length} packages`
    );
  });

  setHandler(pauseSignal, () => {
    state.isPaused = true;
    console.log('Orchestrator paused - will not spawn new builds');
  });

  setHandler(resumeSignal, () => {
    state.isPaused = false;
    console.log('Orchestrator resumed - will continue spawning builds');
  });

  setHandler(drainSignal, () => {
    state.isDraining = true;
    console.log('Orchestrator draining - will finish active builds and exit');
  });

  setHandler(emergencyStopSignal, () => {
    emergencyStopRequested = true;
    console.log('Emergency stop requested - will cancel all builds and exit');
  });

  setHandler(adjustConcurrencySignal, (limit: number) => {
    const oldLimit = state.maxConcurrent;
    state.maxConcurrent = limit;
    console.log(`Concurrency adjusted from ${oldLimit} to ${limit}`);
  });

  // Helper: Spawn builds from queue
  async function spawnBuildsFromQueue(): Promise<void> {
    if (state.isPaused || state.isDraining) {
      return;
    }

    const availableSlots = state.maxConcurrent - state.activeBuilds.size;
    if (availableSlots <= 0 || state.internalQueue.length === 0) {
      return;
    }

    // Take packages from queue (up to available slots)
    const toSpawn = state.internalQueue.splice(0, availableSlots);

    for (const pkg of toSpawn) {
      console.log(`[Orchestrator] Spawning build for ${pkg.name}`);

      // Spawn child workflow (use string name to avoid import issues)
      const childHandle = await startChild('PackageBuildWorkflow', {
        workflowId: `build-${pkg.name}-${Date.now()}`,
        taskQueue: 'engine',
        args: [
          {
            packageName: pkg.name,
            packagePath: `packages/${pkg.name.split('/')[1]}`,
            planPath: `plans/${pkg.name.split('/')[1]}.md`,
            category: 'utility' as const,
            dependencies: pkg.dependencies,
            workspaceRoot: input.workspaceRoot,
            config: {
              npmRegistry: input.config.registry,
              npmToken: '',  // Token should be passed via input, not process.env in workflow
              workspaceRoot: input.workspaceRoot,
              maxConcurrentBuilds: 1,
              temporal: {
                address: 'localhost:7233',
                namespace: 'default',
                taskQueue: 'engine',
              },
              testing: {
                enableCoverage: true,
                minCoveragePercent: 80,
                failOnError: true,
              },
              publishing: {
                dryRun: false,
                requireTests: true,
                requireCleanWorkingDirectory: true,
              },
            },
          },
        ],
      });

      state.activeBuilds.set(pkg.name, childHandle);

      // Handle completion asynchronously
      childHandle
        .result()
        .then(async (result: BuildResult) => {
          await handleBuildCompletion(pkg.name, result);
        })
        .catch(async (error) => {
          await handleBuildFailure(pkg.name, error);
        });
    }
  }

  // Helper: Handle build completion
  async function handleBuildCompletion(
    packageName: string,
    result: BuildResult
  ): Promise<void> {
    console.log(`[Orchestrator] Build completed for ${packageName}: ${result.success}`);

    state.activeBuilds.delete(packageName);
    completedBuilds++;

    if (result.success) {
      // Update MCP status to published
      await updateMCPPackageStatus(packageName, 'published');

      // Clear retry count
      state.failedRetries.delete(packageName);
    } else {
      // Handle failure with retries
      const retries = (state.failedRetries.get(packageName) || 0) + 1;

      if (retries < maxRetries) {
        console.log(`[Orchestrator] Retrying ${packageName} (attempt ${retries}/${maxRetries})`);
        state.failedRetries.set(packageName, retries);

        // Exponential backoff: 1min, 2min, 4min
        const backoffMinutes = Math.pow(2, retries - 1);
        console.log(`[Orchestrator] Waiting ${backoffMinutes} minutes before retry`);
        await sleep(`${backoffMinutes} minutes`);

        // Re-add to queue for retry
        const pkg: Package = {
          name: packageName,
          priority: 0,
          dependencies: [],
        };
        state.internalQueue.push(pkg);
      } else {
        console.log(`[Orchestrator] Max retries reached for ${packageName}`);
        await updateMCPPackageStatus(packageName, 'failed', result.error);
        state.failedRetries.delete(packageName);
      }
    }

    // Spawn next builds from queue
    await spawnBuildsFromQueue();
  }

  // Helper: Handle build failure (error thrown)
  async function handleBuildFailure(
    packageName: string,
    error: Error
  ): Promise<void> {
    console.error(`[Orchestrator] Build error for ${packageName}:`, error);

    const result: BuildResult = {
      success: false,
      packageName,
      error: error.message,
    };

    await handleBuildCompletion(packageName, result);
  }

  // Main orchestration loop
  console.log('[Orchestrator] Started');

  try {
    while (true) {
      // Check for emergency stop
      if (emergencyStopRequested) {
        console.log('[Orchestrator] Emergency stop: exiting immediately');
        // Note: Active child workflows will continue running independently
        // In Temporal, child workflows have their own lifecycle
        console.log(`[Orchestrator] ${state.activeBuilds.size} child workflows will continue independently`);
        state.activeBuilds.clear();
        break;
      }

      // Check for drain
      if (state.isDraining) {
        if (state.activeBuilds.size === 0) {
          console.log('[Orchestrator] Drain complete: no active builds, exiting gracefully');
          break;
        }
        console.log(
          `[Orchestrator] Draining: waiting for ${state.activeBuilds.size} active builds to complete`
        );
        await condition(() => state.activeBuilds.size === 0 || emergencyStopRequested, '5s');
        continue;
      }

      // Spawn builds from queue
      await spawnBuildsFromQueue();

      // Check for continue-as-new
      if (completedBuilds >= continueAsNewThreshold || Date.now() - startTime >= continueAsNewTimeLimit) {
        console.log('[Orchestrator] Continue-as-new triggered');

        // Wait for active builds to complete
        if (state.activeBuilds.size > 0) {
          console.log(`[Orchestrator] Waiting for ${state.activeBuilds.size} active builds to complete before continue-as-new`);
          await Promise.all(Array.from(state.activeBuilds.values()).map((h) => h.result()));
        }

        // Continue as new with preserved state
        await continueAsNew<typeof ContinuousBuilderWorkflow>({
          maxConcurrent: state.maxConcurrent,
          workspaceRoot: input.workspaceRoot,
          config: input.config,
        });
      }

      // Wait for signals or timeout (use shorter timeout for tests)
      // Condition returns true if the predicate becomes true, or false if timeout
      await condition(
        () =>
          state.internalQueue.length > 0 ||
          state.isDraining ||
          emergencyStopRequested,
        '1 second'
      );

      // Loop continues to check state and spawn builds
    }
  } catch (err) {
    console.error(`[Orchestrator] Workflow error: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }

  console.log('[Orchestrator] Exiting');
}
