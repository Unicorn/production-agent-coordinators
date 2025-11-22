import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';
import { DependencyTree, TaskStatus } from '../types/dependency-tree.types';
import { TaskInput } from '../types/task.types';

// Create activity proxies for ALL activities (Temporal best practice)
const {
  createBrainGridREQ,
  createBrainGridTasks,
  buildDependencyTree
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes'
});

export interface PlanningWorkflowInput {
  featureRequest: string;
  repoPath: string;
  projectId?: string;
}

export interface PlanningWorkflowResult {
  success: boolean;
  reqId: string;
  taskCount: number;
}

/**
 * Minimal FeaturePlanningWorkflow (Phase 1)
 *
 * Creates BrainGrid REQ and task breakdown
 * Does NOT include conversational gathering or Slack integration yet
 */
export async function FeaturePlanningWorkflow(
  input: PlanningWorkflowInput
): Promise<PlanningWorkflowResult> {
  const { featureRequest, projectId } = input;

  console.log(`[Planning] Creating REQ for: ${featureRequest}`);

  // Step 1: Create BrainGrid REQ
  const reqId = await createBrainGridREQ({
    description: featureRequest,
    projectId
  });

  console.log(`[Planning] Created REQ: ${reqId}`);

  // Step 2: Mock task breakdown (Phase 1 - will be AI-powered later)
  const mockTasks: TaskInput[] = [
    {
      id: 'task-1',
      reqId,
      name: 'Setup and configuration',
      description: 'Initial setup for ' + featureRequest,
      tags: ['DEV', 'backend'],
      dependencies: []
    },
    {
      id: 'task-2',
      reqId,
      name: 'Implementation',
      description: 'Core implementation',
      tags: ['DEV', 'frontend'],
      dependencies: ['task-1']
    },
    {
      id: 'task-3',
      reqId,
      name: 'Tests',
      description: 'Write tests',
      tags: ['TEST'],
      dependencies: ['task-2']
    }
  ];

  console.log(`[Planning] Created ${mockTasks.length} tasks`);

  // Step 3: Build dependency tree
  const dependencyTree = await buildDependencyTree(reqId, mockTasks);

  console.log(`[Planning] Built dependency tree with ${dependencyTree.layers.length} layers`);

  // Step 4: Create tasks in BrainGrid
  await createBrainGridTasks(reqId, mockTasks);

  console.log(`[Planning] Published tasks to BrainGrid`);

  return {
    success: true,
    reqId,
    taskCount: mockTasks.length
  };
}
