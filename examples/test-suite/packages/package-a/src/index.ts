/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { addNumbers, simulateDelay } from './utils';
import { PackageResult } from './types';
import { BernierError, ValidationError } from './errors';

export {
  PackageResult,
  BernierError,
  ValidationError,
  addNumbers,
  simulateDelay
};

/**
 * Initializes the Bernier LLC production agent coordinator.
 * @param config Optional configuration object.
 * @returns A promise that resolves to a PackageResult indicating success or failure.
 */
export async function initializeAgentCoordinator(
  config?: Record<string, unknown>
): Promise<PackageResult<string>> {
  console.log('Initializing Bernier LLC agent coordinator with config:', config);

  try {
    const delayResult: PackageResult<string> = await simulateDelay(100);
    if (!delayResult.success) {
      throw new BernierError(`Failed to simulate delay during initialization: ${delayResult.error}`);
    }

    const sumResult: PackageResult<number> = addNumbers(5, 7);
    if (!sumResult.success) {
      throw new ValidationError(`Failed to add numbers during initialization: ${sumResult.error}`);
    }
    console.log('Sum:', sumResult.data);

    return { success: true, data: 'Bernier LLC agent coordinator initialized successfully.' };
  } catch (error: unknown) {
    let errorMessage: string = 'An unknown error occurred during initialization.';
    if (error instanceof BernierError || error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: `Initialization failed: ${errorMessage}` };
  }
}