/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Standard result pattern for package operations.
 * @template T The type of the data returned on success.
 */
export interface PackageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Represents an entity with a unique identifier.
 */
export interface Identifiable {
  id: string;
}

/**
 * A union type representing common primitive JavaScript types.
 */
export type Primitive = string | number | boolean | symbol | null | undefined;

/**
 * Extracts the keys of an object type `T` as a union of string literals.
 * @template T The object type to extract keys from.
 */
export type KeyOf<T> = keyof T;

/**
 * Makes all properties of an object type `T` optional and deeply partial.
 * This means properties of nested objects will also be optional.
 * @template T The object type to make deeply partial.
 */
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

/**
 * A branded type for enhancing type safety by differentiating between
 * values of the same base type.
 * @template T The base type.
 * @template Brand A literal string or symbol used to brand the type.
 */
export type Branded<T, Brand extends string | symbol> = T & { readonly __brand__: Brand };