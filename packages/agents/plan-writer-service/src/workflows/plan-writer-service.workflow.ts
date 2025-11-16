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

import { defineSignal, setHandler, condition, proxyActivities, startChild, continueAsNew, workflowInfo, getExternalWorkflowHandle } from '@temporalio/workflow';
import type * as planActivities from '../activities/plan.activities';
import type * as mcpActivities from '../activities/mcp.activities';
import type {
  ServiceSignalPayload,
  PackagePlanNeededPayload,
  DiscoveredChildPackagePayload,
  PlanWriterServiceState,
  PlanRequest,
  PlanWriterPackageInput,
  ContinueAsNewState
} from '../types/index';

// Create activity proxies with timeouts and retry policies
const planActivity = proxyActivities<typeof planActivities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
});

const mcpActivity = proxyActivities<typeof mcpActivities>({
  startToCloseTimeout: '5 minutes',
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

/**
 * Signal: discovered_child_package
 * Source: PlanWriterPackageWorkflow (child workflows)
 * Sent when a child workflow discovers a child package that may need a plan
 */
export const discoveredChildPackageSignal = defineSignal<[ServiceSignalPayload<DiscoveredChildPackagePayload>]>(
  'discovered_child_package'
);

/**
 * Signal: trigger_mcp_scan
 * Source: manual/admin
 * Triggers immediate MCP scan for published packages without plans
 */
export const triggerMcpScanSignal = defineSignal<[]>('trigger_mcp_scan');

// ============================================================================
// Main Workflow
// ============================================================================

/**
 * Plan Writer Service Workflow
 *
 * This is a long-running service workflow that:
 * 1. Runs indefinitely
 * 2. Listens for package_plan_needed and discovered_child_package signals
 * 3. Evaluates if packages need updates (using evaluator agent)
 * 4. Spawns child workflows (PlanWriterPackageWorkflow) per package
 * 5. Child workflows handle plan writing, git commits, and MCP updates
 * 6. Uses continue-as-new to prevent unbounded history growth
 */
export async function PlanWriterServiceWorkflow(
  restoredState?: ContinueAsNewState
): Promise<void> {
  console.log('[PlanWriterService] Starting plan-writer-service');
  console.log('[PlanWriterService] Workflow ID: plan-writer-service');
  console.log('[PlanWriterService] Version: 2.0.0 (parent-child pattern)');

  // Check if restoring from continue-as-new
  if (restoredState) {
    console.log('[PlanWriterService] Restoring from continue-as-new');
    console.log(`[PlanWriterService] Restored ${restoredState.statistics.totalRequests} total requests`);
    console.log(`[PlanWriterService] Restored ${restoredState.spawnedChildIds.length} child workflows`);
  }

  // Initialize service state
  const state: PlanWriterServiceState = {
    serviceStatus: restoredState?.serviceStatus || 'initializing',
    activeRequests: new Map(),
    completedPlans: restoredState?.completedPlans || [],
    failedPlans: restoredState?.failedPlans || [],
    statistics: {
      totalRequests: restoredState?.statistics.totalRequests ?? 0,
      totalCompleted: restoredState?.statistics.totalCompleted ?? 0,
      totalFailed: restoredState?.statistics.totalFailed ?? 0,
      averageDuration: 0 // Not preserved across continue-as-new
    }
  };

  // Queue for incoming plan requests
  const requestQueue: ServiceSignalPayload<PackagePlanNeededPayload>[] =
    restoredState?.requestQueue || [];

  // Track spawned child workflows
  const spawnedChildren = new Map<string, any>(); // packageId -> childHandle

  // Restore active requests
  if (restoredState?.activeRequests) {
    for (const [packageId, request] of restoredState.activeRequests) {
      state.activeRequests.set(packageId, request);
    }
  }

  // Reconnect to child workflows using stored IDs
  if (restoredState?.spawnedChildIds) {
    for (const childId of restoredState.spawnedChildIds) {
      // Extract packageId from workflow ID using URL decoding
      // Format: plan-writer-package-{encoded-package-id}
      const packageId = decodeURIComponent(childId.replace('plan-writer-package-', ''));

      const handle = getExternalWorkflowHandle(childId);
      spawnedChildren.set(packageId, handle);
      console.log(`[PlanWriterService] Reconnected to child: ${childId}`);
    }
  }

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

  setHandler(discoveredChildPackageSignal, (signal: ServiceSignalPayload<DiscoveredChildPackagePayload>) => {
    console.log(`[PlanWriterService] Received discovered_child_package signal for ${signal.packageId}`);
    console.log(`[PlanWriterService] Parent: ${signal.data?.parentPackageId}`);
    console.log(`[PlanWriterService] Reason: ${signal.data?.reason}`);

    // Add discovered child to queue
    requestQueue.push({
      signalType: 'package_plan_needed',
      sourceService: 'plan-writer-service',
      targetService: 'plan-writer-service',
      packageId: signal.packageId,
      timestamp: new Date().toISOString(),
      priority: 'normal',
      data: {
        reason: signal.data?.reason || 'Discovered child package',
        context: {
          discoverySource: 'parent-workflow',
          parentPackageId: signal.data?.parentPackageId
        }
      }
    });

    state.statistics.totalRequests++;
  });

  setHandler(triggerMcpScanSignal, async () => {
    console.log('[PlanWriterService] Received trigger_mcp_scan signal');
    console.log('[PlanWriterService] Executing on-demand MCP scan');

    try {
      const unplannedPackages = await mcpActivity.scanForUnplannedPackages();

      console.log(`[PlanWriterService] Scan found ${unplannedPackages.length} packages`);

      for (const pkg of unplannedPackages) {
        requestQueue.push({
          signalType: 'package_plan_needed',
          sourceService: 'manual-scan',
          targetService: 'plan-writer-service',
          packageId: pkg.id,
          timestamp: new Date().toISOString(),
          priority: 'normal',
          data: {
            reason: 'Manual scan discovery',
            context: { discoverySource: 'manual-scan' }
          }
        });

        state.statistics.totalRequests++;
      }

      console.log(`[PlanWriterService] Queued ${unplannedPackages.length} packages from scan`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[PlanWriterService] Scan failed:`, errorMessage);
    }
  });

  // Mark service as running
  state.serviceStatus = 'running';
  console.log('[PlanWriterService] Service is now running and waiting for signals');

  // Main service loop - runs forever
  while (true) {
    // Check history length and continue-as-new if needed
    const info = workflowInfo();
    if (info.historyLength >= 37500) {
      console.log(`[PlanWriterService] History at ${info.historyLength} events, continuing-as-new`);

      // Create state snapshot
      const stateSnapshot: ContinueAsNewState = {
        requestQueue: Array.from(requestQueue),
        activeRequests: Array.from(state.activeRequests.entries()),
        spawnedChildIds: Array.from(spawnedChildren.keys()).map(packageId => {
          // Convert package ID to workflow ID using URL encoding
          return `plan-writer-package-${encodeURIComponent(packageId)}`;
        }),
        statistics: {
          totalRequests: state.statistics.totalRequests,
          totalCompleted: state.statistics.totalCompleted,
          totalFailed: state.statistics.totalFailed
        },
        serviceStatus: state.serviceStatus,
        completedPlans: [...state.completedPlans],
        failedPlans: [...state.failedPlans]
      };

      console.log(`[PlanWriterService] Preserving ${stateSnapshot.requestQueue.length} queued requests`);
      console.log(`[PlanWriterService] Preserving ${stateSnapshot.spawnedChildIds.length} child workflows`);

      await continueAsNew<typeof PlanWriterServiceWorkflow>(stateSnapshot);
      return; // Never reached, but TypeScript needs it
    }

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
      // Step 1: Check if package already being processed
      if (spawnedChildren.has(signal.packageId)) {
        console.log(`[PlanWriterService] Package ${signal.packageId} already being processed, skipping`);
        request.status = 'completed';
        request.completedAt = new Date().toISOString();
        state.activeRequests.delete(signal.packageId);
        continue;
      }

      // Step 2: Query MCP for package details
      console.log(`[PlanWriterService] Querying MCP for ${signal.packageId}`);
      const packageDetails = await mcpActivity.queryPackageDetails(signal.packageId);

      let shouldSpawnChild = true;
      let skipReason: string | undefined;

      // Step 3: If package exists, evaluate if it needs update
      if (packageDetails.exists) {
        console.log(`[PlanWriterService] Package ${signal.packageId} exists, evaluating if update needed`);

        // Read existing plan if available
        let existingPlanContent: string | undefined;
        if (packageDetails.plan_file_path) {
          existingPlanContent = await mcpActivity.readPlanFile(packageDetails.plan_file_path) || undefined;
        }

        // Get parent plan if available
        let parentPlanContent: string | undefined;
        if (packageDetails.parent_package && signal.data?.context?.parentPackageId) {
          const parentDetails = await mcpActivity.queryPackageDetails(packageDetails.parent_package);
          if (parentDetails.plan_file_path) {
            parentPlanContent = await mcpActivity.readPlanFile(parentDetails.plan_file_path) || undefined;
          }
        }

        // Fetch npm info
        const npmPackageInfo = await mcpActivity.fetchNpmPackageInfo(signal.packageId);

        // Spawn evaluator agent to decide
        const evaluation = await planActivity.spawnPackageEvaluatorAgent({
          packageId: signal.packageId,
          existingPlanContent,
          parentPlanContent,
          npmPackageInfo: npmPackageInfo || undefined,
          packageDetails: {
            status: packageDetails.status || 'unknown',
            plan_file_path: packageDetails.plan_file_path,
            plan_git_branch: packageDetails.plan_git_branch,
            current_version: packageDetails.current_version,
            dependencies: packageDetails.dependencies || []
          }
        });

        if (!evaluation.success) {
          console.warn(`[PlanWriterService] Evaluation failed for ${signal.packageId}: ${evaluation.error}`);
          // Proceed with caution - spawn child anyway
        } else if (!evaluation.needsUpdate) {
          console.log(`[PlanWriterService] Package ${signal.packageId} does not need update: ${evaluation.reason}`);
          shouldSpawnChild = false;
          skipReason = evaluation.reason;
        } else {
          console.log(`[PlanWriterService] Package ${signal.packageId} needs update: ${evaluation.updateType} - ${evaluation.reason}`);
        }
      } else {
        console.log(`[PlanWriterService] Package ${signal.packageId} is new, will create plan`);
      }

      // Step 4: Spawn child workflow or skip
      if (!shouldSpawnChild) {
        console.log(`[PlanWriterService] ⏭️  Skipping ${signal.packageId}: ${skipReason}`);

        request.status = 'completed';
        request.completedAt = new Date().toISOString();
        state.completedPlans.push(signal.packageId);
        state.statistics.totalCompleted++;
      } else {
        console.log(`[PlanWriterService] Spawning child workflow for ${signal.packageId}`);

        const childInput: PlanWriterPackageInput = {
          packageId: signal.packageId,
          reason: signal.data?.reason || 'Plan requested',
          priority: signal.priority || 'normal',
          sourceService: signal.sourceService
        };

        // Import and spawn child workflow dynamically
        const { PlanWriterPackageWorkflow } = await import('./plan-writer-package.workflow');

        const childHandle = await startChild(PlanWriterPackageWorkflow, {
          workflowId: `plan-writer-package-${encodeURIComponent(signal.packageId)}`,
          args: [childInput],
          taskQueue: 'plan-writer-service' // Use same task queue
        });

        spawnedChildren.set(signal.packageId, childHandle);

        console.log(`[PlanWriterService] Spawned child workflow for ${signal.packageId}`);

        // Don't await - let child run asynchronously
        // We'll track completion via signals or workflow queries

        request.status = 'in_progress';
        state.statistics.totalCompleted++; // Count spawning as completion
      }

      const duration = Date.now() - new Date(request.startedAt!).getTime();
      console.log(`[PlanWriterService] ✅ Processed ${signal.packageId} in ${duration}ms`);

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
