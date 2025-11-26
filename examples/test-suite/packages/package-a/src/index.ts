/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Interface for standard package results, including success status, optional data, and optional error message.
 * @template T The type of the data returned on success.
 */
export interface PackageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * A sample function demonstrating the Bernier LLC error handling pattern and TypeScript strictness.
 * It always returns a successful result for demonstration purposes.
 * @returns A PackageResult indicating success and a dummy data string.
 */
export function initializePackage(): PackageResult<string> {
  try {
    const message: string = "Package initialized successfully.";
    // Example of handling potential null/undefined (though not strictly needed here)
    const result: string | undefined = Math.random() > 0.1 ? message : undefined;

    if (result === undefined) {
      return { success: false, error: "Initialization result was unexpectedly undefined." };
    }

    return { success: true, data: result };
  } catch (err: unknown) {
    const errorMessage: string = err instanceof Error ? err.message : String(err);
    return { success: false, error: `An unexpected error occurred during initialization: ${errorMessage}` };
  }
}

/**
 * An asynchronous sample function.
 * @returns A promise that resolves to a PackageResult.
 */
export async function performAsyncOperation(): Promise<PackageResult<string>> {
  try {
    // Simulate an async operation
    await new Promise((resolve) => setTimeout(resolve, 50));
    const data: string = "Async operation completed.";
    return { success: true, data };
  } catch (err: unknown) {
    const errorMessage: string = err instanceof Error ? err.message : String(err);
    return { success: false, error: `An unexpected error occurred during async operation: ${errorMessage}` };
  }
}
```