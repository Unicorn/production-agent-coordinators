import type { PackageWorkflowInput } from '../types';

export interface ParsedInput {
  type: 'packageName' | 'packageIdea' | 'planFilePath' | 'updatePrompt';
  value: string;
}

export function parseInput(input: PackageWorkflowInput): ParsedInput {
  if (input.packageName) {
    return { type: 'packageName', value: input.packageName };
  }
  if (input.packageIdea) {
    return { type: 'packageIdea', value: input.packageIdea };
  }
  if (input.planFilePath) {
    return { type: 'planFilePath', value: input.planFilePath };
  }
  if (input.updatePrompt) {
    return { type: 'updatePrompt', value: input.updatePrompt };
  }
  throw new Error('No input provided. Must provide one of: packageName, packageIdea, planFilePath, updatePrompt');
}
