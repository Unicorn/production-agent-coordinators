/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { PackageResult, PlanFileContent } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Reads a plan file from the given file path.
 *
 * @param filePath - The absolute or relative path to the plan file.
 * @returns A PackageResult containing the parsed plan file content or an error.
 */
export async function readPlanFile(filePath: string): Promise<PackageResult<PlanFileContent>> {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    return { success: false, error: 'File path must be a non-empty string.' };
  }

  const absolutePath: string = path.resolve(filePath);

  try {
    const fileContent: string = await fs.readFile(absolutePath, { encoding: 'utf-8' });
    // Using `as PlanFileContent` is safe here if we validate afterwards or if we trust the source.
    // For strictness, more robust runtime validation could be added, but basic checks are included.
    const parsedContent: PlanFileContent = JSON.parse(fileContent) as PlanFileContent;

    // Basic runtime validation for essential fields
    if (
      !parsedContent ||
      typeof parsedContent.id !== 'string' ||
      typeof parsedContent.name !== 'string' ||
      !Array.isArray(parsedContent.steps) ||
      parsedContent.steps.some(step =>
        typeof step.stepId !== 'string' ||
        typeof step.action !== 'string' ||
        typeof step.details !== 'object' ||
        step.details === null
      )
    ) {
      return { success: false, error: 'Invalid plan file format: missing or malformed id, name, or steps.' };
    }

    return { success: true, data: parsedContent };
  } catch (error: unknown) {
    let errorMessage: string = 'An unknown error occurred.';
    if (error instanceof Error) {
      errorMessage = error.message;
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        errorMessage = `File not found at ${absolutePath}`;
      } else if (error instanceof SyntaxError) {
        errorMessage = `Invalid JSON format in file: ${errorMessage}`;
      }
    }
    return { success: false, error: `Failed to read or parse plan file: ${errorMessage}` };
  }
}

/**
 * A placeholder function to demonstrate another async operation and type usage.
 * This function could simulate executing a plan based on its ID.
 *
 * @param planId - The ID of the plan to execute.
 * @returns A PackageResult indicating success or failure of the execution simulation.
 */
export async function executePlan(planId: string): Promise<PackageResult<string>> {
  if (typeof planId !== 'string' || planId.trim() === '') {
    return { success: false, error: 'Plan ID must be a non-empty string.' };
  }

  // Simulate complex asynchronous work, like coordinating agents
  await new Promise(resolve => setTimeout(resolve, 100));

  // In a real scenario, this would involve more detailed logic and error handling
  // For now, it just simulates success.
  return { success: true, data: `Plan '${planId}' execution simulated successfully.` };
}
```