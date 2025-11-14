import { describe, it, expect } from 'vitest';
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

  // TODO: Add integration tests with TestWorkflowEnvironment
  // Full workflow execution tests require compiled JavaScript and Temporal test environment
  // These can be added in a future phase when we set up proper integration testing
});
