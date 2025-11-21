import { runBrainGridCommand } from '../cli';
import { BrainGridTask, BrainGridTaskSchema } from '../models';

export interface CreateTaskOptions {
  title: string;
  description?: string;
  tags?: string[];
  dependencies?: string[];
}

/**
 * Create a task in BrainGrid under a requirement
 */
export async function createTask(
  reqId: string,
  options: CreateTaskOptions
): Promise<BrainGridTask> {
  const args = ['task', 'create', reqId, '--title', options.title];

  if (options.description) {
    args.push('--description', options.description);
  }

  if (options.tags && options.tags.length > 0) {
    args.push('--tags', options.tags.join(','));
  }

  if (options.dependencies && options.dependencies.length > 0) {
    args.push('--dependencies', options.dependencies.join(','));
  }

  args.push('--format', 'json');

  const result = await runBrainGridCommand(args);

  const parsed = BrainGridTaskSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error(`Invalid BrainGrid response: ${parsed.error.message}`);
  }

  return parsed.data;
}
