/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import * as fs from 'fs/promises';
import * as path from 'path';

import { PackageResult } from './types';

/**
 * Represents the structure of a parsed plan file.
 */
export interface PlanFileContent {
  content: string;
  filePath: string;
}

/**
 * Reads the content of a plan file from the specified path.
 *
 * @param filePath The absolute path to the plan file.
 * @returns A PackageResult containing the plan file content or an error.
 */
export async function readPlanFile(filePath: string): Promise<PackageResult<PlanFileContent>> {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return { success: false, error: 'File path must be a non-empty string.' };
  }

  const absolutePath = path.resolve(filePath);

  try {
    const content = await fs.readFile(absolutePath, { encoding: 'utf-8' });
    return { success: true, data: { content, filePath: absolutePath } };
  } catch (error: unknown) {
    let errorMessage = 'Failed to read plan file.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: `Failed to read plan file at '${absolutePath}': ${errorMessage}` };
  }
}