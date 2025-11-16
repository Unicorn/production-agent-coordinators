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

  // TODO: Add integration tests with TestWorkflowEnvironment
  // Full workflow execution tests require compiled JavaScript and Temporal test environment
  // These can be added in a future phase when we set up proper integration testing
});
