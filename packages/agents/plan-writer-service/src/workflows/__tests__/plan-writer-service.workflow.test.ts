import { describe, it, expect } from 'vitest';
import { PlanWriterServiceWorkflow, packagePlanNeededSignal, triggerMcpScanSignal } from '../plan-writer-service.workflow';

describe('Plan Writer Service Workflow', () => {
  it('should have correct workflow metadata', () => {
    expect(PlanWriterServiceWorkflow.name).toBe('PlanWriterServiceWorkflow');
  });

  it('should define packagePlanNeededSignal', () => {
    expect(packagePlanNeededSignal).toBeDefined();
    expect(packagePlanNeededSignal.name).toBe('package_plan_needed');
  });

  it('should define triggerMcpScanSignal', () => {
    expect(triggerMcpScanSignal).toBeDefined();
    expect(triggerMcpScanSignal.name).toBe('trigger_mcp_scan');
  });

  it('should accept optional ContinueAsNewState parameter', () => {
    // This test verifies the workflow signature at compile time
    // If the workflow doesn't accept the optional parameter, TypeScript will error
    type ContinueAsNewState = import('../types/index').ContinueAsNewState;

    // Type assertion: workflow should accept optional ContinueAsNewState
    // This will cause a TypeScript error until we update the workflow signature
    const _typeCheck: (state?: ContinueAsNewState) => Promise<void> = PlanWriterServiceWorkflow;

    expect(_typeCheck).toBeDefined();
  });

  // TODO: Add integration tests with TestWorkflowEnvironment
  // Full workflow execution tests require compiled JavaScript and Temporal test environment
  // These can be added in a future phase when we set up proper integration testing
});
