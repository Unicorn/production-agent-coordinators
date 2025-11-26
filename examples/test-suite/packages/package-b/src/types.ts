/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { PackageResult } from './utils'; // Assuming PackageResult is in utils based on requirement

// Example of a base interface
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Example of a common type
export type UUID = string & { readonly brand: unique symbol };

/**
 * Type guard for checking if an object is a BaseEntity.
 * @param obj The object to check.
 * @returns True if the object implements BaseEntity, false otherwise.
 */
export function isBaseEntity(obj: unknown): obj is BaseEntity {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    typeof (obj as BaseEntity).id === 'string' &&
    'createdAt' in obj &&
    (obj as BaseEntity).createdAt instanceof Date &&
    'updatedAt' in obj &&
    (obj as BaseEntity).updatedAt instanceof Date
  );
}

/**
 * Creates a branded UUID type from a string.
 * Note: This function performs no validation; it simply casts the type.
 * Use with caution and ensure input is a valid UUID.
 * @param value The string to brand as UUID.
 * @returns A branded UUID.
 */
export function createUUID(value: string): UUID {
  // In a real application, you might add validation here.
  // For now, it's a simple type assertion for branding.
  return value as UUID;
}

// Re-export PackageResult from utils for easier access through index.ts
export { PackageResult };