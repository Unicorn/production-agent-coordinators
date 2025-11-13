import { defineSignal } from '@temporalio/workflow';

export interface PlanRequest {
  packageName: string;
  requestedBy: string;  // workflow ID
  timestamp: number;
  priority: 'high' | 'low';
  source: 'workflow-request' | 'discovery';
}

export const requestPlanSignal = defineSignal<[PlanRequest]>('requestPlan');
