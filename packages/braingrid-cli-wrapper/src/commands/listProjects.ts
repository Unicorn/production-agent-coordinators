import { runBrainGridCommand } from '../cli';
import { BrainGridProject, BrainGridProjectSchema } from '../models';
import { z } from 'zod';

/**
 * List all projects in BrainGrid
 */
export async function listProjects(): Promise<BrainGridProject[]> {
  const result = await runBrainGridCommand(['projects', 'list', '--format', 'json']);

  const parsed = z.array(BrainGridProjectSchema).safeParse(result);
  if (!parsed.success) {
    throw new Error(`Invalid BrainGrid response: ${parsed.error.message}`);
  }

  return parsed.data;
}
