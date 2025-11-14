import { describe, it, expect } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { PlanWriterServiceWorkflow, packagePlanNeededSignal } from '../plan-writer-service.workflow';
import * as activities from '../../activities/plan.activities';
import type { ServiceSignalPayload, PackagePlanNeededPayload } from '../../types/index';

describe('Plan Writer Service Workflow', () => {
  it('should have correct workflow metadata', () => {
    expect(PlanWriterServiceWorkflow.name).toBe('PlanWriterServiceWorkflow');
  });

  it('should define packagePlanNeededSignal', () => {
    expect(packagePlanNeededSignal).toBeDefined();
    expect(packagePlanNeededSignal.name).toBe('package_plan_needed');
  });

  // TODO: Add integration tests with TestWorkflowEnvironment
  // These will test the full workflow execution with mocked activities
});
