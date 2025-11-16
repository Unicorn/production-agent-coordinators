import { describe, it, expect, vi } from 'vitest';
import { PlanWriterPackageWorkflow, PlanWriterPackageWorkflowMetadata } from '../plan-writer-package.workflow';

describe('PlanWriterPackageWorkflow', () => {
  it('should have correct workflow metadata', () => {
    expect(PlanWriterPackageWorkflow.name).toBe('PlanWriterPackageWorkflow');
  });

  it('should export workflow metadata', () => {
    expect(PlanWriterPackageWorkflowMetadata).toBeDefined();
    expect(PlanWriterPackageWorkflowMetadata.name).toBe('PlanWriterPackageWorkflow');
    expect(PlanWriterPackageWorkflowMetadata.serviceType).toBe('short-running');
    expect(PlanWriterPackageWorkflowMetadata.description).toContain('single package');
  });

  it('should have correct workflow structure', () => {
    // Verify it's an async function that accepts input
    expect(PlanWriterPackageWorkflow).toBeInstanceOf(Function);
    expect(PlanWriterPackageWorkflow.constructor.name).toBe('AsyncFunction');
  });

  it('should import fibonacciBackoff utility', async () => {
    // Verify the import is used in the workflow
    const workflowSource = PlanWriterPackageWorkflow.toString();
    expect(workflowSource).toContain('fibonacciBackoff');
  });

  it('should use Fibonacci backoff for parent plan waiting', async () => {
    // Verify workflow code contains Fibonacci backoff pattern
    const workflowSource = PlanWriterPackageWorkflow.toString();

    // Check for backoff initialization with 30min cap (may be compiled as 1e3)
    expect(workflowSource).toMatch(/fibonacciBackoff\(30 \* 60 \* (1000|1e3)\)/);

    // Check for indefinite retry loop (while true)
    expect(workflowSource).toContain('while (true)');

    // Check for backoff.next().value usage
    expect(workflowSource).toContain('backoff.next().value');

    // Check for logging of wait intervals in minutes (may be compiled as 6e4)
    expect(workflowSource).toMatch(/waitMs \/ (60000|6e4)/);
  });

  it('should not have timeout-based polling logic', async () => {
    // Verify old timeout-based code is removed
    const workflowSource = PlanWriterPackageWorkflow.toString();

    // Should NOT have maxWaitMs
    expect(workflowSource).not.toContain('maxWaitMs');

    // Should NOT have pollIntervalMs
    expect(workflowSource).not.toContain('pollIntervalMs');

    // Should NOT have startTime tracking
    expect(workflowSource).not.toContain('startTime = Date.now()');

    // Should NOT check elapsed time
    expect(workflowSource).not.toContain('Date.now() - startTime');
  });

  it('should log wait intervals correctly', async () => {
    // Verify logging structure for backoff intervals
    const workflowSource = PlanWriterPackageWorkflow.toString();

    // Should log "Parent not ready, waiting Xm..."
    expect(workflowSource).toContain('Parent not ready, waiting');

    // Should log "Parent plan exists!" when ready
    expect(workflowSource).toContain('Parent plan exists!');
  });

  it('should use sleep with dynamic backoff values', async () => {
    // Verify sleep is called with backoff values
    const workflowSource = PlanWriterPackageWorkflow.toString();

    // Should call sleep with waitMs from backoff (sleep may be transformed to __vite_ssr_import)
    expect(workflowSource).toMatch(/await .+\.sleep\(waitMs\)/);
  });

  it('should check parent plan existence in retry loop', async () => {
    // Verify the retry loop checks for plan existence
    const workflowSource = PlanWriterPackageWorkflow.toString();

    // Should query package details in loop
    expect(workflowSource).toContain('queryPackageDetails(parentId)');

    // Should check plan file path
    expect(workflowSource).toContain('plan_file_path');

    // Should check if plan exists
    expect(workflowSource).toContain('checkPlanExists');
  });

  it('should import getExternalWorkflowHandle from @temporalio/workflow', async () => {
    // Verify the import is present by checking the workflow source
    const workflowSource = PlanWriterPackageWorkflow.toString();

    // Should use getExternalWorkflowHandle
    expect(workflowSource).toContain('getExternalWorkflowHandle');
  });

  it('should import packagePlanNeededSignal from plan-writer-service.workflow', async () => {
    // Verify signal import is used in the workflow
    const workflowSource = PlanWriterPackageWorkflow.toString();

    // Should reference packagePlanNeededSignal
    expect(workflowSource).toContain('packagePlanNeededSignal');
  });

  it('should signal service when parent has no plan', async () => {
    // Verify workflow signals parent service when parent package has no plan
    const workflowSource = PlanWriterPackageWorkflow.toString();

    // Should get external workflow handle for plan-writer-service (may be compiled)
    expect(workflowSource).toMatch(/getExternalWorkflowHandle\(["']plan-writer-service["']\)/);

    // Should create signal payload with correct structure (may be compiled)
    expect(workflowSource).toMatch(/signalType:\s*["']package_plan_needed["']/);
    expect(workflowSource).toMatch(/sourceService:\s*["']plan-writer-service["']/);
    expect(workflowSource).toMatch(/targetService:\s*["']plan-writer-service["']/);

    // Should signal when parent has no plan (may be compiled)
    expect(workflowSource).toMatch(/reason:\s*["']Missing parent plan - queuing parent["']/);
    expect(workflowSource).toMatch(/discoverySource:\s*["']parent-dependency["']/);
  });

  it('should signal service for children needing plans', async () => {
    // Verify workflow signals service for each child that needs a plan
    const workflowSource = PlanWriterPackageWorkflow.toString();

    // Should signal for children (may be compiled)
    expect(workflowSource).toMatch(/reason:\s*["']Missing child plan - queuing child["']/);
    expect(workflowSource).toMatch(/discoverySource:\s*["']child-dependency["']/);

    // Should check if child has plan before signaling
    expect(workflowSource).toContain('queryPackageDetails(childId)');

    // Should iterate over children
    expect(workflowSource).toContain('for (const childId of children)');
  });

  it('should send signals with correct payload structure', async () => {
    // Verify signal payload structure matches ServiceSignalPayload<PackagePlanNeededPayload>
    const workflowSource = PlanWriterPackageWorkflow.toString();

    // Should include required fields
    expect(workflowSource).toContain('signalType:');
    expect(workflowSource).toContain('sourceService:');
    expect(workflowSource).toContain('targetService:');
    expect(workflowSource).toContain('packageId:');
    expect(workflowSource).toContain('timestamp:');
    expect(workflowSource).toContain('priority:');

    // Should include data with reason and context
    expect(workflowSource).toContain('reason:');
    expect(workflowSource).toContain('context:');
    expect(workflowSource).toContain('discoverySource:');
    expect(workflowSource).toContain('parentPackageId:');

    // Should use signal method
    expect(workflowSource).toContain('.signal(');
  });

  // TODO: Add integration tests with TestWorkflowEnvironment
  // Full workflow execution tests require compiled JavaScript and Temporal test environment
  // These can be added in a future phase when we set up proper integration testing
});
