/**
 * PlanWriterPackageWorkflow
 *
 * Short-running workflow that writes plan for a single package.
 * Discovers lineage, waits for parent plans, writes with context, commits to Git.
 *
 * Pattern: Child workflow spawned by PlanWriterServiceWorkflow
 */

import { proxyActivities, sleep, getExternalWorkflowHandle } from '@temporalio/workflow';
import type * as mcpActivities from '../activities/mcp.activities';
import type * as planActivities from '../activities/plan.activities';
import type {
  PlanWriterPackageInput,
  PlanWriterPackageResult,
  ServiceSignalPayload,
  PackagePlanNeededPayload
} from '../types/index';
import { packagePlanNeededSignal } from './plan-writer-service.workflow';
import { fibonacciBackoff } from '../utils/backoff';

// Export metadata for workflow registry
export { PlanWriterPackageWorkflowMetadata } from '../types/index';

// Configure activity proxies with timeouts
const mcp = proxyActivities<typeof mcpActivities>({
  startToCloseTimeout: '5 minutes'
});

const plan = proxyActivities<typeof planActivities>({
  startToCloseTimeout: '10 minutes'
});

/**
 * PlanWriterPackageWorkflow
 *
 * Creates implementation plan for a single package:
 * 1. Discover lineage (parent chain)
 * 2. Wait for parent plans to exist
 * 3. Read parent plan for context
 * 4. Spawn plan writer agent with context
 * 5. Commit plan to Git
 * 6. Update MCP status
 * 7. Discover children
 * 8. Signal service about children
 */
export async function PlanWriterPackageWorkflow(
  input: PlanWriterPackageInput
): Promise<PlanWriterPackageResult> {
  console.log(`[PlanWriterPackageWorkflow] Starting for ${input.packageId}`);
  console.log(`[PlanWriterPackageWorkflow] Reason: ${input.reason}`);
  console.log(`[PlanWriterPackageWorkflow] Priority: ${input.priority}`);

  try {
    // Step 1: Get package lineage
    console.log(`[PlanWriterPackageWorkflow] Step 1: Discovering lineage`);
    const lineage = await mcp.queryPackageLineage(input.packageId);
    console.log(`[PlanWriterPackageWorkflow] Lineage depth: ${lineage.depth}`);
    console.log(`[PlanWriterPackageWorkflow] Parents: ${lineage.parents.join(' → ')}`);

    // Step 2: Wait for parent plans (if any)
    for (const parentId of lineage.parents) {
      console.log(`[PlanWriterPackageWorkflow] Step 2: Checking parent: ${parentId}`);

      const parentDetails = await mcp.queryPackageDetails(parentId);

      if (!parentDetails.plan_file_path) {
        console.log(`[PlanWriterPackageWorkflow] Parent ${parentId} has no plan`);
        console.log(`[PlanWriterPackageWorkflow] Signaling service to queue parent`);

        // Signal parent service to queue parent package
        try {
          const serviceHandle = getExternalWorkflowHandle('plan-writer-service');
          const signalPayload: ServiceSignalPayload<PackagePlanNeededPayload> = {
            signalType: 'package_plan_needed',
            sourceService: 'plan-writer-service',
            targetService: 'plan-writer-service',
            packageId: parentId,
            timestamp: new Date().toISOString(),
            priority: 'high', // Parent dependencies are high priority
            data: {
              reason: 'Missing parent plan - queuing parent',
              context: {
                discoverySource: 'parent-dependency',
                parentPackageId: input.packageId
              }
            }
          };

          await serviceHandle.signal(packagePlanNeededSignal, signalPayload);
          console.log(`[PlanWriterPackageWorkflow] Signaled service for parent ${parentId}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.warn(`[PlanWriterPackageWorkflow] Failed to signal about parent:`, errorMessage);
          // Continue - we'll wait for parent anyway
        }

        console.log(`[PlanWriterPackageWorkflow] Waiting for parent plan to exist...`);

        // Wait indefinitely with Fibonacci backoff
        const backoff = fibonacciBackoff(30 * 60 * 1000); // 30min cap

        while (true) {
          const details = await mcp.queryPackageDetails(parentId);

          if (details.plan_file_path) {
            const planExists = await mcp.checkPlanExists(details.plan_file_path);
            if (planExists) {
              console.log(`[PlanWriterPackageWorkflow] Parent plan exists!`);
              break;
            }
          }

          const waitMs = backoff.next().value as number;
          console.log(`[PlanWriterPackageWorkflow] Parent not ready, waiting ${waitMs / 60000}m...`);
          await sleep(waitMs);
        }
      } else {
        console.log(`[PlanWriterPackageWorkflow] Parent ${parentId} has plan: ${parentDetails.plan_file_path}`);
      }
    }

    // Step 3: Read parent plan for context
    console.log(`[PlanWriterPackageWorkflow] Step 3: Reading parent plan`);
    let parentPlanContent: string | undefined;
    let parentPackageId: string | undefined;

    if (lineage.parents.length > 0) {
      // Use immediate parent (first in array)
      parentPackageId = lineage.parents[0];
      const parentDetails = await mcp.queryPackageDetails(parentPackageId);

      if (parentDetails.plan_file_path) {
        console.log(`[PlanWriterPackageWorkflow] Reading parent plan: ${parentDetails.plan_file_path}`);
        parentPlanContent = await mcp.readPlanFile(parentDetails.plan_file_path) || undefined;

        if (parentPlanContent) {
          console.log(`[PlanWriterPackageWorkflow] Parent plan loaded (${parentPlanContent.length} chars)`);
        } else {
          console.warn(`[PlanWriterPackageWorkflow] Parent plan file empty or unreadable`);
        }
      } else {
        console.warn(`[PlanWriterPackageWorkflow] Parent has no plan file path`);
      }
    } else {
      console.log(`[PlanWriterPackageWorkflow] No parents - this is a root package`);
    }

    // Step 4: Write plan with context
    console.log(`[PlanWriterPackageWorkflow] Step 4: Spawning plan writer agent`);
    const planResult = await plan.spawnPlanWriterAgent({
      packageId: input.packageId,
      reason: input.reason,
      context: {},
      parentPlanContent,
      parentPackageId,
      lineage: lineage.parents
    });

    if (!planResult.success) {
      throw new Error(planResult.error || 'Plan writing failed');
    }

    console.log(`[PlanWriterPackageWorkflow] Plan written: ${planResult.planFilePath}`);

    // Step 5: Commit to Git
    console.log(`[PlanWriterPackageWorkflow] Step 5: Committing to Git`);
    const gitBranch = `feature/${input.packageId.replace('@', '').replace('/', '-')}`;
    const commitResult = await plan.gitCommitPlan({
      packageId: input.packageId,
      planFilePath: planResult.planFilePath,
      gitBranch,
      commitMessage: `feat: Add implementation plan for ${input.packageId}`
    });

    if (!commitResult.success) {
      console.warn(`[PlanWriterPackageWorkflow] Git commit failed: ${commitResult.error}`);
      // Continue - this is not critical
    } else {
      console.log(`[PlanWriterPackageWorkflow] Committed as ${commitResult.commitSha}`);
    }

    // Step 6: Update MCP
    console.log(`[PlanWriterPackageWorkflow] Step 6: Updating MCP`);
    const mcpResult = await plan.updateMCPStatus({
      packageId: input.packageId,
      planFilePath: planResult.planFilePath,
      gitBranch,
      status: 'planning' // API expects: planning, development, testing, published, deprecated, archived
    });

    if (mcpResult.success) {
      console.log(`[PlanWriterPackageWorkflow] MCP updated successfully`);
    } else {
      console.warn(`[PlanWriterPackageWorkflow] MCP update failed: ${mcpResult.error}`);
      console.warn(`[PlanWriterPackageWorkflow] Continuing anyway - plan is committed to Git`);
    }

    // Step 7: Discover children
    console.log(`[PlanWriterPackageWorkflow] Step 7: Discovering children`);
    const children = await mcp.queryChildPackages(input.packageId);

    if (children.length > 0) {
      console.log(`[PlanWriterPackageWorkflow] Found ${children.length} children`);
      for (const childId of children) {
        console.log(`[PlanWriterPackageWorkflow] Child: ${childId}`);
      }
    } else {
      console.log(`[PlanWriterPackageWorkflow] No children found`);
    }

    // Step 8: Signal service for each child
    console.log(`[PlanWriterPackageWorkflow] Step 8: Signaling service about children`);

    if (children.length > 0) {
      const serviceHandle = getExternalWorkflowHandle('plan-writer-service');

      for (const childId of children) {
        console.log(`[PlanWriterPackageWorkflow] Checking if child ${childId} needs plan`);

        // Check if child already has a plan
        const childDetails = await mcp.queryPackageDetails(childId);

        if (!childDetails.plan_file_path) {
          console.log(`[PlanWriterPackageWorkflow] Child ${childId} has no plan, signaling service`);

          const signalPayload: ServiceSignalPayload<PackagePlanNeededPayload> = {
            signalType: 'package_plan_needed',
            sourceService: 'plan-writer-service',
            targetService: 'plan-writer-service',
            packageId: childId,
            timestamp: new Date().toISOString(),
            priority: 'normal',
            data: {
              reason: 'Missing child plan - queuing child',
              context: {
                discoverySource: 'child-dependency',
                parentPackageId: input.packageId
              }
            }
          };

          await serviceHandle.signal(packagePlanNeededSignal, signalPayload);
          console.log(`[PlanWriterPackageWorkflow] Signaled service for child ${childId}`);
        } else {
          console.log(`[PlanWriterPackageWorkflow] Child ${childId} already has plan: ${childDetails.plan_file_path}`);
        }
      }
    } else {
      console.log(`[PlanWriterPackageWorkflow] No children to signal`);
    }

    console.log(`[PlanWriterPackageWorkflow] Completed successfully for ${input.packageId}`);

    return {
      success: true,
      packageId: input.packageId,
      planFilePath: planResult.planFilePath,
      gitBranch,
      childrenDiscovered: children
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PlanWriterPackageWorkflow] Failed for ${input.packageId}:`, errorMessage);

    return {
      success: false,
      packageId: input.packageId,
      error: errorMessage
    };
  }
}
