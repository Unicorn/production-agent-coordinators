/**
 * Plan Writer Service Workflow
 *
 * Long-running service workflow that writes package plans and files them to MCP.
 * Following standards from: docs/plans/2025-11-13-temporal-workflow-standardization-and-service-architecture.md
 *
 * Workflow ID: plan-writer-service (no datetime!)
 * Service Type: long-running
 * Signals From: discovery-service, monitor-service, integration-service, ideation-service
 * Signals To: mcp-api
 */

import { defineSignal, setHandler, condition, proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/plan.activities';
import type {
  ServiceSignalPayload,
  PackagePlanNeededPayload,
  PlanWriterServiceState,
  PlanRequest
} from '../types/index';

// Create activity proxies with timeouts and retry policies
const {
  spawnPlanWriterAgent,
  gitCommitPlan,
  updateMCPStatus
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
});

// ============================================================================
// Signal Definitions
// ============================================================================

/**
 * Signal: package_plan_needed
 * Source: discovery-service, monitor-service, integration-service, ideation-service
 * Triggers plan writing for a package
 */
export const packagePlanNeededSignal = defineSignal<[ServiceSignalPayload<PackagePlanNeededPayload>]>(
  'package_plan_needed'
);

/**
 * Signal: pause_service
 * Source: manual/admin
 * Pauses the service (stops processing new requests)
 */
export const pauseServiceSignal = defineSignal<[]>('pause_service');

/**
 * Signal: resume_service
 * Source: manual/admin
 * Resumes the service
 */
export const resumeServiceSignal = defineSignal<[]>('resume_service');

// ============================================================================
// Main Workflow
// ============================================================================

/**
 * Plan Writer Service Workflow
 *
 * This is a long-running service workflow that:
 * 1. Runs indefinitely
 * 2. Listens for package_plan_needed signals
 * 3. Writes plans using AI agents
 * 4. Commits plans to Git (--no-verify)
 * 5. Updates MCP with plan metadata
 */
export async function PlanWriterServiceWorkflow(): Promise<void> {
  console.log('[PlanWriterService] Starting plan-writer-service');
  console.log('[PlanWriterService] Workflow ID: plan-writer-service');
  console.log('[PlanWriterService] Version: 1.0.0');

  // Initialize service state
  const state: PlanWriterServiceState = {
    serviceStatus: 'initializing',
    activeRequests: new Map(),
    completedPlans: [],
    failedPlans: [],
    statistics: {
      totalRequests: 0,
      totalCompleted: 0,
      totalFailed: 0,
      averageDuration: 0
    }
  };

  // Queue for incoming plan requests
  const requestQueue: ServiceSignalPayload<PackagePlanNeededPayload>[] = [];

  // Set up signal handlers
  setHandler(packagePlanNeededSignal, (signal: ServiceSignalPayload<PackagePlanNeededPayload>) => {
    console.log(`[PlanWriterService] Received package_plan_needed signal for ${signal.packageId}`);
    console.log(`[PlanWriterService] Source: ${signal.sourceService}`);
    console.log(`[PlanWriterService] Priority: ${signal.priority || 'normal'}`);

    requestQueue.push(signal);
    state.statistics.totalRequests++;
  });

  setHandler(pauseServiceSignal, () => {
    console.log('[PlanWriterService] Received pause_service signal');
    state.serviceStatus = 'paused';
  });

  setHandler(resumeServiceSignal, () => {
    console.log('[PlanWriterService] Received resume_service signal');
    state.serviceStatus = 'running';
  });

  // Mark service as running
  state.serviceStatus = 'running';
  console.log('[PlanWriterService] Service is now running and waiting for signals');

  // Main service loop - runs forever
  while (true) {
    // Wait for either a new request or service to be unpaused
    await condition(() => requestQueue.length > 0 && state.serviceStatus === 'running');

    // Get next request from queue
    const signal = requestQueue.shift();
    if (!signal) continue;

    console.log(`[PlanWriterService] Processing request for ${signal.packageId}`);

    // Create request record
    const request: PlanRequest = {
      packageId: signal.packageId,
      signal,
      status: 'in_progress',
      startedAt: new Date().toISOString()
    };

    state.activeRequests.set(signal.packageId, request);

    try {
      // Step 1: Write plan using AI agent
      const planResult = await spawnPlanWriterAgent({
        packageId: signal.packageId,
        reason: signal.data?.reason || 'Plan requested',
        context: signal.data?.context || {}
      });

      if (!planResult.success) {
        throw new Error(planResult.error || 'Plan writing failed');
      }

      console.log(`[PlanWriterService] Plan written for ${signal.packageId}`);

      // Step 2: Commit plan to Git
      const gitBranch = `feature/${signal.packageId.replace('@', '').replace('/', '-')}`;
      const commitResult = await gitCommitPlan({
        packageId: signal.packageId,
        planFilePath: planResult.planFilePath,
        gitBranch,
        commitMessage: `feat: Add implementation plan for ${signal.packageId}\n\n${signal.data?.reason || 'Plan requested'}`
      });

      if (!commitResult.success) {
        throw new Error(commitResult.error || 'Git commit failed');
      }

      console.log(`[PlanWriterService] Plan committed to ${gitBranch} (${commitResult.commitSha})`);

      // Step 3: Update MCP
      const mcpResult = await updateMCPStatus({
        packageId: signal.packageId,
        planFilePath: planResult.planFilePath,
        gitBranch,
        status: 'plan_written'
      });

      if (!mcpResult.success) {
        throw new Error(mcpResult.error || 'MCP update failed');
      }

      console.log(`[PlanWriterService] MCP updated for ${signal.packageId}`);

      // Mark request as completed
      request.status = 'completed';
      request.completedAt = new Date().toISOString();
      state.completedPlans.push(signal.packageId);
      state.statistics.totalCompleted++;

      // Update average duration
      const duration = Date.now() - new Date(request.startedAt!).getTime();
      state.statistics.averageDuration =
        (state.statistics.averageDuration * (state.statistics.totalCompleted - 1) + duration) /
        state.statistics.totalCompleted;

      console.log(`[PlanWriterService] ✅ Completed plan for ${signal.packageId} in ${duration}ms`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`[PlanWriterService] ❌ Failed to process ${signal.packageId}:`, errorMessage);

      // Mark request as failed
      request.status = 'failed';
      request.completedAt = new Date().toISOString();
      request.error = errorMessage;

      state.failedPlans.push({
        packageId: signal.packageId,
        error: errorMessage,
        retryable: true,
        attemptCount: 1
      });

      state.statistics.totalFailed++;

      // TODO: Send failure signal to monitoring service
    } finally {
      // Remove from active requests
      state.activeRequests.delete(signal.packageId);
    }
  }
}
