/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

export interface PackageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface Agent {
  id: string;
  status: 'idle' | 'busy' | 'offline';
  capabilities: string[];
  lastHeartbeat: number; // Unix timestamp
}

export interface Task {
  id: string;
  agentId: string | null; // Agent assigned to this task
  status: 'pending' | 'assigned' | 'in-progress' | 'completed' | 'failed';
  type: string;
  payload: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  result?: Record<string, unknown>;
  error?: string;
}

export interface CoordinatorEvent<T = unknown> {
  type: string;
  timestamp: number;
  payload: T;
}