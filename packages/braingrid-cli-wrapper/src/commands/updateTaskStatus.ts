import { runBrainGridCommand } from '../cli';
import { TaskStatus } from '../models';

export interface UpdateTaskOptions {
  status?: TaskStatus;
  assignedTo?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Update task status and metadata in BrainGrid
 */
export async function updateTaskStatus(
  taskId: string,
  options: UpdateTaskOptions
): Promise<void> {
  const args = ['task', 'update', taskId];

  if (options.status) {
    args.push('--status', options.status);
  }

  if (options.assignedTo) {
    args.push('--assigned-to', options.assignedTo);
  }

  if (options.metadata) {
    args.push('--metadata', JSON.stringify(options.metadata));
  }

  await runBrainGridCommand(args);
}
