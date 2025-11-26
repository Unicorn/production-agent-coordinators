/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Standard result pattern for package operations.
 * @template T - The type of data returned on success. Defaults to `unknown`.
 */
export interface PackageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Represents the configuration for the AgentCoordinatorClient.
 */
export interface ClientConfig {
  /** The base URL for the Agent Coordinator API. */
  baseUrl: string;
  /** The API key used for authentication. */
  apiKey: string;
  /** Optional timeout for API requests in milliseconds. */
  timeoutMs?: number;
}

/**
 * Represents a basic entity for agents.
 */
export interface Agent {
  /** Unique identifier for the agent. */
  id: string;
  /** Name of the agent. */
  name: string;
  /** Status of the agent (e.g., 'active', 'inactive'). */
  status: string;
  /** Optional description of the agent. */
  description?: string;
  /** Timestamp when the agent was created. */
  createdAt: string;
  /** Timestamp when the agent was last updated. */
  updatedAt: string;
}

/**
 * Represents the input for creating a new agent.
 */
export interface CreateAgentInput {
  /** Name of the agent. */
  name: string;
  /** Status of the agent (e.g., 'active', 'inactive'). */
  status: string;
  /** Optional description of the agent. */
  description?: string;
}

/**
 * Represents the input for updating an existing agent.
 */
export interface UpdateAgentInput {
  /** Optional new name for the agent. */
  name?: string;
  /** Optional new status for the agent. */
  status?: string;
  /** Optional new description for the agent. */
  description?: string;
}

/**
 * Represents a paginated list of agents.
 */
export interface AgentListResponse {
  /** Array of agents. */
  agents: Agent[];
  /** Total number of agents available. */
  total: number;
  /** Offset for pagination. */
  offset: number;
  /** Limit for pagination. */
  limit: number;
}

/**
 * Options for listing agents.
 */
export interface ListAgentsOptions {
  /** Offset for pagination. Defaults to 0. */
  offset?: number;
  /** Limit for pagination. Defaults to 10. */
  limit?: number;
  /** Optional filter by agent status. */
  status?: string;
}

/**
 * Represents the input for sending a message to an agent.
 */
export interface SendMessageInput {
  /** The content of the message. */
  content: string;
  /** Optional metadata associated with the message. */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a message sent to or from an agent.
 */
export interface AgentMessage {
  /** Unique identifier for the message. */
  id: string;
  /** The ID of the agent involved. */
  agentId: string;
  /** The content of the message. */
  content: string;
  /** Optional metadata associated with the message. */
  metadata?: Record<string, unknown>;
  /** Timestamp when the message was created. */
  createdAt: string;
}

/**
 * Represents a paginated list of agent messages.
 */
export interface AgentMessageListResponse {
  /** Array of agent messages. */
  messages: AgentMessage[];
  /** Total number of messages available. */
  total: number;
  /** Offset for pagination. */
  offset: number;
  /** Limit for pagination. */
  limit: number;
}

/**
 * Options for listing agent messages.
 */
export interface ListAgentMessagesOptions {
  /** Offset for pagination. Defaults to 0. */
  offset?: number;
  /** Limit for pagination. Defaults to 10. */
  limit?: number;
  /** Optional filter by message content keyword. */
  keyword?: string;
}

/**
 * Represents an AgentCoordinator event.
 */
export interface AgentEvent {
  /** Unique identifier for the event. */
  id: string;
  /** The ID of the agent involved. */
  agentId: string;
  /** Type of event (e.g., 'agent_created', 'agent_updated', 'message_sent'). */
  type: string;
  /** Data associated with the event. */
  payload: Record<string, unknown>;
  /** Timestamp when the event occurred. */
  createdAt: string;
}

/**
 * Represents a paginated list of agent events.
 */
export interface AgentEventListResponse {
  /** Array of agent events. */
  events: AgentEvent[];
  /** Total number of events available. */
  total: number;
  /** Offset for pagination. */
  offset: number;
  /** Limit for pagination. */
  limit: number;
}

/**
 * Options for listing agent events.
 */
export interface ListAgentEventsOptions {
  /** Offset for pagination. Defaults to 0. */
  offset?: number;
  /** Limit for pagination. Defaults to 10. */
  limit?: number;
  /** Optional filter by event type. */
  type?: string;
}