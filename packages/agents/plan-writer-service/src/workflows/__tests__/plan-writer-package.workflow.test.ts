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

  // TODO: Add integration tests with TestWorkflowEnvironment
  // Full workflow execution tests require compiled JavaScript and Temporal test environment
  // These can be added in a future phase when we set up proper integration testing
});
