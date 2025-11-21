import {
  createIdea,
  createTask as braingridCreateTask,
  updateTaskStatus as braingridUpdateTaskStatus,
  listTasks as braingridListTasks,
  BrainGridRequirement,
  BrainGridTask
} from '@bernierllc/braingrid-cli-wrapper';
import { TaskInput, PollTaskParams } from '../types/task.types';

/**
 * Create a requirement in BrainGrid
 */
export async function createBrainGridREQ(params: {
  description: string;
  projectId?: string;
}): Promise<string> {
  const req = await createIdea(params.description, params.projectId);
  return req.id;
}

/**
 * Create tasks in BrainGrid
 */
export async function createBrainGridTasks(
  reqId: string,
  tasks: TaskInput[]
): Promise<void> {
  for (const task of tasks) {
    await braingridCreateTask(reqId, {
      title: task.name,
      description: task.description,
      tags: task.tags,
      dependencies: task.dependencies
    });
  }
}

/**
 * Poll BrainGrid for available tasks
 */
export async function pollForTask(params: PollTaskParams): Promise<BrainGridTask | null> {
  const tasks = await braingridListTasks({
    tags: params.tags,
    status: params.status as any[]
  });

  if (tasks.length === 0) {
    return null;
  }

  // Return first available task
  return tasks[0];
}

/**
 * Claim a task in BrainGrid
 */
export async function claimTask(
  taskId: string,
  workerId: string
): Promise<void> {
  await braingridUpdateTaskStatus(taskId, {
    status: 'IN_PROGRESS',
    assignedTo: workerId,
    metadata: {
      claimedAt: new Date().toISOString()
    }
  });
}

/**
 * Update task progress
 */
export async function updateTaskProgress(
  taskId: string,
  progress: number,
  message: string
): Promise<void> {
  await braingridUpdateTaskStatus(taskId, {
    metadata: {
      progress,
      message,
      updatedAt: new Date().toISOString()
    }
  });
}

/**
 * Complete a task
 */
export async function completeTask(
  taskId: string,
  result: any
): Promise<void> {
  await braingridUpdateTaskStatus(taskId, {
    status: 'COMPLETED',
    metadata: {
      result,
      completedAt: new Date().toISOString()
    }
  });
}
