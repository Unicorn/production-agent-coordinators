/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { z } from 'zod';
import { AgentStatus, CoordinatorStatus } from './types';

/**
 * Zod schema for Date objects. Preprocesses strings or Dates into Date objects.
 */
const zDate = z.preprocess((arg: unknown) => {
  if (typeof arg === 'string' || arg instanceof Date) {
    const date = new Date(arg);
    return isNaN(date.getTime()) ? undefined : date; // Return undefined for invalid dates
  }
  return arg;
}, z.date());

/** Zod schema for AgentStatus enum. */
export const agentStatusSchema = z.enum(['online', 'offline', 'busy', 'unavailable']) as z.ZodType<AgentStatus>;
/** Zod schema for CoordinatorStatus enum. */
export const coordinatorStatusSchema = z.enum(['active', 'inactive', 'error']) as z.ZodType<CoordinatorStatus>;

/** Zod schema for an Agent object. */
export const agentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  status: agentStatusSchema,
  lastHeartbeat: zDate,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Zod schema for data used to create a new agent. */
export const newAgentDataSchema = z.object({
  name: z.string().min(1),
  status: agentStatusSchema.default('offline'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Zod schema for data used to update an existing agent. */
export const updateAgentDataSchema = z.object({
  name: z.string().min(1).optional(),
  status: agentStatusSchema.optional(),
  lastHeartbeat: zDate.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Zod schema for a Coordinator object. */
export const coordinatorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  status: coordinatorStatusSchema,
  agentIds: z.array(z.string().uuid()),
  config: z.record(z.string(), z.unknown()),
  createdAt: zDate,
  updatedAt: zDate,
});

/** Zod schema for data used to create a new coordinator. */
export const newCoordinatorDataSchema = z.object({
  name: z.string().min(1),
  agentIds: z.array(z.string().uuid()).default([]),
  config: z.record(z.string(), z.unknown()).default({}),
});

/** Zod schema for data used to update an existing coordinator. */
export const updateCoordinatorDataSchema = z.object({
  name: z.string().min(1).optional(),
  status: coordinatorStatusSchema.optional(),
  agentIds: z.array(z.string().uuid()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});