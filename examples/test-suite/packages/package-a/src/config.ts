/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { type CoordinatorSettings } from './types';

/**
 * Default settings for the AgentCoordinator.
 * These values can be overridden during coordinator instantiation.
 */
export const DEFAULT_COORDINATOR_SETTINGS: CoordinatorSettings = {
  heartbeatTimeoutMs: 30000, // Agents must send a heartbeat every 30 seconds
  staleAgentCheckIntervalMs: 10000, // Check for stale agents every 10 seconds
  maxTaskRetries: 3, // Maximum number of times a task can be retried
  baseRetryDelayMs: 1000, // Base delay for exponential backoff in milliseconds
};