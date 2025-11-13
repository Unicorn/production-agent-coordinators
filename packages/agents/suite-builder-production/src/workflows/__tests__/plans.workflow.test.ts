import { describe, it, expect } from 'vitest';
import { PlansWorkflow } from '../plans.workflow';
import { requestPlanSignal, type PlanRequest } from '../../signals/plan-signals';

describe('Plans Workflow', () => {
  it('should be a function', () => {
    expect(typeof PlansWorkflow).toBe('function');
  });

  it('should export PlanRequest interface from signals', () => {
    const validRequest: PlanRequest = {
      packageName: '@bernierllc/github-parser',
      requestedBy: 'build-workflow-123',
      timestamp: Date.now(),
      priority: 'high',
      source: 'workflow-request'
    };

    expect(validRequest.packageName).toBe('@bernierllc/github-parser');
    expect(validRequest.priority).toBe('high');
    expect(validRequest.source).toBe('workflow-request');
  });

  it('should export requestPlanSignal', () => {
    expect(requestPlanSignal).toBeDefined();
    expect(requestPlanSignal.name).toBe('requestPlan');
  });
});
