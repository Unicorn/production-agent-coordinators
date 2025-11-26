/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import * as fs from 'fs/promises';
import { PackageResult } from './index';

/**
 * Reads a file from the given path and attempts to parse it as JSON.
 * @param filePath The path to the file.
 * @returns A PackageResult containing the parsed data or an error.
 */
export async function readAndParseFile<T>(filePath: string): Promise<PackageResult<T>> {
  if (!filePath || filePath.trim() === '') {
    return { success: false, error: "File path cannot be empty." };
  }

  try {
    const fileContent = await fs.readFile(filePath, { encoding: 'utf-8' });
    const parsedData: T = JSON.parse(fileContent);
    return { success: true, data: parsedData };
  } catch (error: unknown) {
    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { success: false, error: `File not found: ${filePath}` };
      }
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        return { success: false, error: `Permission denied to read file: ${filePath}` };
      }
      if (error.name === 'SyntaxError') { // For JSON.parse errors
        return { success: false, error: `Failed to parse file content as JSON: ${error.message}` };
      }
      return { success: false, error: `Unknown file operation error: ${error.message}` };
    }
    return { success: false, error: `An unexpected error occurred: ${String(error)}` };
  }
}
```