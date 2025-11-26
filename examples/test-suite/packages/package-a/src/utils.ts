/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { v4 as uuidv4 } from 'uuid';
import { type AgentId } from './types';

/**
 * Generates a unique agent ID using UUID v4.
 * @returns A unique AgentId string.
 */
export function generateAgentId(): AgentId {
  return uuidv4();
}

/**
 * Calculates exponential backoff delay for retries.
 * @param retryCount The current retry attempt number (0 for first retry).
 * @param baseDelayMs The base delay in milliseconds.
 * @param maxDelayMs The maximum delay allowed.
 * @returns The calculated delay in milliseconds.
 */
export function calculateExponentialBackoff(
  retryCount: number,
  baseDelayMs: number,
  maxDelayMs: number = 300000, // 5 minutes default max delay
): number {
  if (retryCount < 0) {
    return 0;
  }
  const delay = baseDelayMs * Math.pow(2, retryCount);
  return Math.min(delay, maxDelayMs);
}

/**
 * Utility function to deep clone an object.
 * This is useful for immutability when working with state objects.
 * @param obj The object to clone.
 * @returns A deep clone of the object.
 */
export function deepClone<T>(obj: T): T {
  // Simple JSON based deep clone for plain data objects.
  // Not suitable for objects with functions, Dates, Regexps, etc.
  return JSON.parse(JSON.stringify(obj)) as T;
}