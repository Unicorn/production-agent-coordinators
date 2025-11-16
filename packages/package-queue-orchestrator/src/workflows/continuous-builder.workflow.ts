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

import { defineSignal, setHandler } from '@temporalio/workflow';
// TODO: Uncomment when implementing build completion handlers
// import { proxyActivities } from '@temporalio/workflow';
// import type * as activities from '../activities/index.js';
import type { Package, OrchestratorConfig, OrchestratorState } from '../types/index.js';

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
 * @param config - Configuration for the orchestrator
 */
export async function ContinuousBuilderWorkflow(
  config: OrchestratorConfig
): Promise<void> {
  // Initialize state
  const state: OrchestratorState = {
    internalQueue: [],
    activeBuilds: new Map(),
    failedRetries: new Map(),
    isPaused: false,
    isDraining: false,
    maxConcurrent: config.maxConcurrent,
  };

  // Set up signal handlers
  setHandler(newPackagesSignal, (packages: Package[]) => {
    // TODO: Merge packages into internal queue (deduplicate)
    console.log(`Received ${packages.length} new packages`);
  });

  setHandler(pauseSignal, () => {
    state.isPaused = true;
    console.log('Orchestrator paused');
  });

  setHandler(resumeSignal, () => {
    state.isPaused = false;
    console.log('Orchestrator resumed');
  });

  setHandler(drainSignal, () => {
    state.isDraining = true;
    console.log('Orchestrator draining');
  });

  setHandler(emergencyStopSignal, () => {
    // TODO: Cancel all active builds and exit
    console.log('Emergency stop triggered');
  });

  setHandler(adjustConcurrencySignal, (limit: number) => {
    state.maxConcurrent = limit;
    console.log(`Concurrency adjusted to ${limit}`);
  });

  // TODO: Implement main orchestration loop
  // 1. Wait for signals
  // 2. Spawn child workflows up to maxConcurrent
  // 3. Track completions
  // 4. Handle retries
  // 5. Continue-as-new when needed
}
