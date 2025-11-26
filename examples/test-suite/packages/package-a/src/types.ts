/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

// Universal Result Type for Bernier LLC packages
export interface PackageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Agent-specific types
export type AgentId = string;

export enum AgentStatusCode {
  Idle = 'idle',
  Busy = 'busy',
  Offline = 'offline',
  AwaitingRetry = 'awaiting-retry',
  Error = 'error',
}

export enum TaskStatusCode {
  Assigned = 'assigned',
  InProgress = 'in-progress',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
  AwaitingRetry = 'awaiting-retry',
}

export interface AgentTask {
  id: string;
  type: string;
  payload: Record<string, unknown>; // Flexible payload for task specific data
}

export interface AgentTaskHistoryEntry {
  taskId: string;
  status: TaskStatusCode;
  timestamp: number; // Unix timestamp
}

export interface AgentState {
  agentId: AgentId;
  status: AgentStatusCode;
  lastHeartbeat: number; // Unix timestamp
  registeredAt: number; // Unix timestamp
  lastTaskAttempt: number | null; // Unix timestamp of last task assignment attempt
  taskHistory: AgentTaskHistoryEntry[];
  retryCount: number; // Number of times a task has been retried for this agent
}

export interface AgentMessage {
  type: 'ASSIGN_TASK' | 'TASK_STATUS_UPDATE' | 'HEARTBEAT';
  agentId: AgentId;
  payload: AgentTask | { taskId: string; status: TaskStatusCode } | Record<string, never>; // Empty object for heartbeat
}

// Coordinator Settings
export interface CoordinatorSettings {
  heartbeatTimeoutMs: number;
  staleAgentCheckIntervalMs: number;
  maxTaskRetries: number;
  baseRetryDelayMs: number;
}