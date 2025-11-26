/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Standardized result type for all package operations.
 * Provides a consistent way to return data or errors.
 * @template T The type of the data returned on success. Defaults to `unknown`.
 */
export interface PackageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Interface for entities that have a unique identifier.
 */
export interface Identifiable {
  id: string;
}

/**
 * Union type for common primitive JavaScript values.
 */
export type Primitive = string | number | boolean | symbol | null | undefined;

/**
 * Extracts keys of an object type as a union of string literals.
 * @template T The object type.
 */
export type KeyOf<T> = keyof T;

/**
 * Utility type to make all properties of an object (and nested objects) optional.
 * @template T The object type to make deeply partial.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Branded type for compile-time differentiation of otherwise structurally identical types.
 * Helps prevent assigning values of one branded type to another.
 * @template T The base type.
 * @template Brand A unique string literal to identify the brand.
 */
export type Branded<T, Brand extends string> = T & { readonly __brand: Brand };