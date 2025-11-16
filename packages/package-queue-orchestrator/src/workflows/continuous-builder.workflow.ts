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

import { defineSignal, setHandler, condition } from '@temporalio/workflow';
// TODO: Uncomment when implementing build completion handlers
// import { proxyActivities } from '@temporalio/workflow';
// import type * as activities from '../activities/index.js';
import type { Package, OrchestratorInput, OrchestratorState } from '../types/index.js';

// Proxy activities with reasonable timeout
// TODO: Uncomment when implementing build completion handlers
// const { updateMCPPackageStatus } = proxyActivities<typeof activities>({
//   startToCloseTimeout: '5 minutes',
// });

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

  // Main orchestration loop
  // In Part 1, we just wait for drain or emergency stop
  // Part 2 will add the build spawning logic
  try {
    while (true) {
      // Check for emergency stop
      if (emergencyStopRequested) {
        console.log('Emergency stop: exiting immediately');
        // Part 1: No active builds to cancel yet
        // Part 2 will add: Cancel all active builds before exiting
        if (state.activeBuilds.size > 0) {
          console.log(`Warning: ${state.activeBuilds.size} active builds will be cancelled`);
          // TODO: Implement cancellation in Part 2
        }
        break;
      }

      // Check for drain
      if (state.isDraining) {
        // Wait for active builds to complete
        if (state.activeBuilds.size === 0) {
          console.log('Drain complete: no active builds, exiting gracefully');
          break;
        }
        console.log(
          `Draining: waiting for ${state.activeBuilds.size} active builds to complete`
        );
        // Wait a bit before checking again
        await condition(() => state.activeBuilds.size === 0 || emergencyStopRequested, '5s');
        continue;
      }

      // Wait for signals
      // This will be enhanced in Part 2 to spawn builds
      await condition(
        () => emergencyStopRequested || state.isDraining || state.internalQueue.length > 0,
        '30s'
      );

      // If draining or emergency stop, loop will handle it
      // If we have packages but we're paused or at max capacity, just wait
      // Part 2 will add the build spawning logic here
    }
  } catch (err) {
    console.error(`Workflow error: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}
