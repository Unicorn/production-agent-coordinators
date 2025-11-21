import { runBrainGridCommand } from '../cli';
import { BrainGridTask, BrainGridTaskSchema, TaskStatus } from '../models';
import { z } from 'zod';

export interface ListTasksOptions {
  reqId?: string;
  status?: TaskStatus[];
  tags?: string[];
}

/**
 * List tasks in BrainGrid with optional filters
 */
export async function listTasks(options: ListTasksOptions = {}): Promise<BrainGridTask[]> {
  const args = ['task', 'list'];

  if (options.reqId) {
    args.push('--req', options.reqId);
  }

  if (options.status && options.status.length > 0) {
    args.push('--status', options.status.join(','));
  }

  if (options.tags && options.tags.length > 0) {
    args.push('--tags', options.tags.join(','));
  }

  args.push('--format', 'json');

  const result = await runBrainGridCommand(args);

  const parsed = z.array(BrainGridTaskSchema).safeParse(result);
  if (!parsed.success) {
    throw new Error(`Invalid BrainGrid response: ${parsed.error.message}`);
  }

  return parsed.data;
}
