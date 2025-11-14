/**
 * Plan Writer Service
 *
 * Long-running Temporal workflow service for writing package plans.
 * Following standards from: docs/plans/2025-11-13-temporal-workflow-standardization-and-service-architecture.md
 */

// Export workflows
export {
  PlanWriterServiceWorkflow,
  packagePlanNeededSignal,
  pauseServiceSignal,
  resumeServiceSignal,
  discoveredChildPackageSignal
} from './workflows/plan-writer-service.workflow';
export { PlanWriterPackageWorkflow } from './workflows/plan-writer-package.workflow';

// Export activities
export * as PlanActivities from './activities/plan.activities';
export * as MCPActivities from './activities/mcp.activities';

// Export types and metadata
export * from './types/index';
