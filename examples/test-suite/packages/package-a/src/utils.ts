/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/
// src/utils.ts
import { PackageResult } from './types';

/**
 * Generates a universally unique identifier (UUID) using cryptographic randomness.
 * This function relies on the `crypto.randomUUID()` Web Crypto API, which is available
 * in modern browser environments and Node.js (v14.17.0+).
 *
 * For environments where `crypto.randomUUID()` is not available, a less robust
 * fallback ID generation method is used, and a warning is logged.
 *
 * @returns {PackageResult<string>} A result object containing the generated UUID on success,
 * or an error message if the generation process fails.
 */
export function generateUniqueId(): PackageResult<string> {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      const uuid: string = crypto.randomUUID();
      return { success: true, data: uuid };
    } else {
      // Fallback for environments lacking crypto.randomUUID(), though less robust.
      // This should be rare in modern ES2020+ environments.
      const fallbackId: string = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      console.warn("`crypto.randomUUID()` not available, falling back to a less robust ID generation method.");
      return { success: true, data: fallbackId };
    }
  } catch (error: unknown) {
    const errorMessage: string = (error instanceof Error) ? error.message : String(error);
    return { success: false, error: `Failed to generate unique ID: ${errorMessage}` };
  }
}