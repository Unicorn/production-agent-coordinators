import { runBrainGridCommand } from '../cli';
import { BrainGridRequirement, BrainGridRequirementSchema } from '../models';

/**
 * Create a new requirement (IDEA) in BrainGrid
 */
export async function createIdea(
  prompt: string,
  projectId?: string
): Promise<BrainGridRequirement> {
  const args = ['specify', prompt];

  if (projectId) {
    args.push('--project', projectId);
  }

  args.push('--format', 'json');

  const result = await runBrainGridCommand(args);

  // Validate response
  const parsed = BrainGridRequirementSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error(`Invalid BrainGrid response: ${parsed.error.message}`);
  }

  return parsed.data;
}
