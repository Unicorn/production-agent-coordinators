/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import {
  Agent,
  AgentEvent,
  AgentEventListResponse,
  AgentListResponse,
  AgentMessage,
  AgentMessageListResponse,
  ClientConfig,
  CreateAgentInput,
  ListAgentEventsOptions,
  ListAgentMessagesOptions,
  ListAgentsOptions,
  PackageResult,
  SendMessageInput,
  UpdateAgentInput,
} from './types';
import {
  handleFetchError,
  handleHttpResponseError,
  buildFetchOptions,
  validateNonEmptyString,
  validateNonNegativeInteger,
} from './utils';
import { initializeConfig } from './config';
import { AuthenticationError, NotFoundError, ValidationError } from './errors';

/**
 * The `AgentCoordinatorClient` provides methods to interact with the Agent Coordinator API.
 * It manages agents, their messages, and events.
 */
export class AgentCoordinatorClient {
  private readonly config: ClientConfig;

  /**
   * Constructs a new `AgentCoordinatorClient` instance.
   * @param config - The client configuration. This will be validated upon initialization.
   * @throws {AuthenticationError | ValidationError} if the configuration is invalid.
   */
  constructor(config: ClientConfig) {
    const initResult = initializeConfig(config);
    if (!initResult.success || !initResult.data) {
      if (initResult.error?.includes('apiKey')) {
        throw new AuthenticationError(initResult.error);
      }
      throw new ValidationError(initResult.error || 'Failed to initialize client configuration.');
    }
    this.config = initResult.data;
  }

  /**
   * Internal helper for making API requests.
   * @param path - The API endpoint path (e.g., '/agents').
   * @param method - The HTTP method (e.g., 'GET', 'POST').
   * @param body - Optional request body.
   * @returns A `PackageResult` containing the parsed JSON response or an error.
   */
  private async request<T>(path: string, method: string, body?: unknown): Promise<PackageResult<T>> {
    const url = `${this.config.baseUrl}${path}`;
    const fetchOptions = buildFetchOptions(method, this.config.apiKey, body, this.config.timeoutMs);

    try {
      const response = await fetch(url, fetchOptions);

      const errorResult = await handleHttpResponseError<T>(response);
      if (!errorResult.success) {
        return errorResult;
      }

      const data: T = await response.json();
      return { success: true, data };
    } catch (e: unknown) {
      return handleFetchError(e, url);
    }
  }

  /**
   * Retrieves a list of agents.
   * @param options - Optional query parameters for pagination and filtering.
   * @returns A `PackageResult` containing an `AgentListResponse` or an error.
   */
  public async listAgents(options?: ListAgentsOptions): Promise<PackageResult<AgentListResponse>> {
    const query = new URLSearchParams();
    if (options?.offset !== undefined) {
      const validation = validateNonNegativeInteger(options.offset, 'Offset');
      if (!validation.success) {
        return { success: false, error: new ValidationError(validation.error || 'Invalid offset').message };
      }
      query.append('offset', options.offset.toString());
    }
    if (options?.limit !== undefined) {
      const validation = validateNonNegativeInteger(options.limit, 'Limit');
      if (!validation.success) {
        return { success: false, error: new ValidationError(validation.error || 'Invalid limit').message };
      }
      query.append('limit', options.limit.toString());
    }
    if (options?.status !== undefined) {
      const validation = validateNonEmptyString(options.status, 'Status');
      if (!validation.success) {
        return { success: false, error: new ValidationError(validation.error || 'Invalid status').message };
      }
      query.append('status', options.status);
    }

    const path = `/agents${query.toString() ? `?${query.toString()}` : ''}`;
    return this.request<AgentListResponse>(path, 'GET');
  }

  /**
   * Creates a new agent.
   * @param input - The details for the new agent.
   * @returns A `PackageResult` containing the created `Agent` or an error.
   */
  public async createAgent(input: CreateAgentInput): Promise<PackageResult<Agent>> {
    const nameValidation = validateNonEmptyString(input.name, 'Agent name');
    if (!nameValidation.success) {
      return { success: false, error: new ValidationError(nameValidation.error || 'Invalid agent name').message };
    }
    const statusValidation = validateNonEmptyString(input.status, 'Agent status');
    if (!statusValidation.success) {
      return { success: false, error: new ValidationError(statusValidation.error || 'Invalid agent status').message };
    }

    return this.request<Agent>('/agents', 'POST', input);
  }

  /**
   * Retrieves a specific agent by its ID.
   * @param agentId - The unique identifier of the agent.
   * @returns A `PackageResult` containing the `Agent` or an error.
   */
  public async getAgent(agentId: string): Promise<PackageResult<Agent>> {
    const validation = validateNonEmptyString(agentId, 'Agent ID');
    if (!validation.success) {
      return { success: false, error: new ValidationError(validation.error || 'Invalid agent ID').message };
    }
    return this.request<Agent>(`/agents/${agentId}`, 'GET');
  }

  /**
   * Updates an existing agent.
   * @param agentId - The unique identifier of the agent to update.
   * @param input - The fields to update.
   * @returns A `PackageResult` containing the updated `Agent` or an error.
   */
  public async updateAgent(agentId: string, input: UpdateAgentInput): Promise<PackageResult<Agent>> {
    const idValidation = validateNonEmptyString(agentId, 'Agent ID');
    if (!idValidation.success) {
      return { success: false, error: new ValidationError(idValidation.error || 'Invalid agent ID').message };
    }
    if (Object.keys(input).length === 0) {
      return { success: false, error: new ValidationError('Update input cannot be empty.').message };
    }
    if (input.name !== undefined) {
      const nameValidation = validateNonEmptyString(input.name, 'Agent name');
      if (!nameValidation.success) {
        return { success: false, error: new ValidationError(nameValidation.error || 'Invalid agent name').message };
      }
    }
    if (input.status !== undefined) {
      const statusValidation = validateNonEmptyString(input.status, 'Agent status');
      if (!statusValidation.success) {
        return { success: false, error: new ValidationError(statusValidation.error || 'Invalid agent status').message };
      }
    }

    return this.request<Agent>(`/agents/${agentId}`, 'PUT', input);
  }

  /**
   * Deletes an agent by its ID.
   * @param agentId - The unique identifier of the agent to delete.
   * @returns A `PackageResult` indicating success or failure.
   */
  public async deleteAgent(agentId: string): Promise<PackageResult<true>> {
    const validation = validateNonEmptyString(agentId, 'Agent ID');
    if (!validation.success) {
      return { success: false, error: new ValidationError(validation.error || 'Invalid agent ID').message };
    }
    const result = await this.request<Record<string, never>>(`/agents/${agentId}`, 'DELETE'); // Assuming DELETE returns empty object
    return { success: result.success, error: result.error, data: result.success ? true : undefined };
  }

  /**
   * Sends a message to a specific agent.
   * @param agentId - The unique identifier of the agent.
   * @param input - The message details.
   * @returns A `PackageResult` containing the sent `AgentMessage` or an error.
   */
  public async sendMessageToAgent(agentId: string, input: SendMessageInput): Promise<PackageResult<AgentMessage>> {
    const idValidation = validateNonEmptyString(agentId, 'Agent ID');
    if (!idValidation.success) {
      return { success: false, error: new ValidationError(idValidation.error || 'Invalid agent ID').message };
    }
    const contentValidation = validateNonEmptyString(input.content, 'Message content');
    if (!contentValidation.success) {
      return { success: false, error: new ValidationError(contentValidation.error || 'Invalid message content').message };
    }

    return this.request<AgentMessage>(`/agents/${agentId}/messages`, 'POST', input);
  }

  /**
   * Retrieves a list of messages for a specific agent.
   * @param agentId - The unique identifier of the agent.
   * @param options - Optional query parameters for pagination and filtering.
   * @returns A `PackageResult` containing an `AgentMessageListResponse` or an error.
   */
  public async listAgentMessages(agentId: string, options?: ListAgentMessagesOptions): Promise<PackageResult<AgentMessageListResponse>> {
    const idValidation = validateNonEmptyString(agentId, 'Agent ID');
    if (!idValidation.success) {
      return { success: false, error: new ValidationError(idValidation.error || 'Invalid agent ID').message };
    }

    const query = new URLSearchParams();
    if (options?.offset !== undefined) {
      const validation = validateNonNegativeInteger(options.offset, 'Offset');
      if (!validation.success) {
        return { success: false, error: new ValidationError(validation.error || 'Invalid offset').message };
      }
      query.append('offset', options.offset.toString());
    }
    if (options?.limit !== undefined) {
      const validation = validateNonNegativeInteger(options.limit, 'Limit');
      if (!validation.success) {
        return { success: false, error: new ValidationError(validation.error || 'Invalid limit').message };
      }
      query.append('limit', options.limit.toString());
    }
    if (options?.keyword !== undefined) {
      const validation = validateNonEmptyString(options.keyword, 'Keyword');
      if (!validation.success) {
        return { success: false, error: new ValidationError(validation.error || 'Invalid keyword').message };
      }
      query.append('keyword', options.keyword);
    }

    const path = `/agents/${agentId}/messages${query.toString() ? `?${query.toString()}` : ''}`;
    return this.request<AgentMessageListResponse>(path, 'GET');
  }

  /**
   * Retrieves a specific message for an agent by its ID.
   * @param agentId - The unique identifier of the agent.
   * @param messageId - The unique identifier of the message.
   * @returns A `PackageResult` containing the `AgentMessage` or an error.
   */
  public async getAgentMessage(agentId: string, messageId: string): Promise<PackageResult<AgentMessage>> {
    const agentIdValidation = validateNonEmptyString(agentId, 'Agent ID');
    if (!agentIdValidation.success) {
      return { success: false, error: new ValidationError(agentIdValidation.error || 'Invalid agent ID').message };
    }
    const messageIdValidation = validateNonEmptyString(messageId, 'Message ID');
    if (!messageIdValidation.success) {
      return { success: false, error: new ValidationError(messageIdValidation.error || 'Invalid message ID').message };
    }
    return this.request<AgentMessage>(`/agents/${agentId}/messages/${messageId}`, 'GET');
  }

  /**
   * Retrieves a list of events for a specific agent.
   * @param agentId - The unique identifier of the agent.
   * @param options - Optional query parameters for pagination and filtering.
   * @returns A `PackageResult` containing an `AgentEventListResponse` or an error.
   */
  public async listAgentEvents(agentId: string, options?: ListAgentEventsOptions): Promise<PackageResult<AgentEventListResponse>> {
    const idValidation = validateNonEmptyString(agentId, 'Agent ID');
    if (!idValidation.success) {
      return { success: false, error: new ValidationError(idValidation.error || 'Invalid agent ID').message };
    }

    const query = new URLSearchParams();
    if (options?.offset !== undefined) {
      const validation = validateNonNegativeInteger(options.offset, 'Offset');
      if (!validation.success) {
        return { success: false, error: new ValidationError(validation.error || 'Invalid offset').message };
      }
      query.append('offset', options.offset.toString());
    }
    if (options?.limit !== undefined) {
      const validation = validateNonNegativeInteger(options.limit, 'Limit');
      if (!validation.success) {
        return { success: false, error: new ValidationError(validation.error || 'Invalid limit').message };
      }
      query.append('limit', options.limit.toString());
    }
    if (options?.type !== undefined) {
      const validation = validateNonEmptyString(options.type, 'Type');
      if (!validation.success) {
        return { success: false, error: new ValidationError(validation.error || 'Invalid type').message };
      }
      query.append('type', options.type);
    }

    const path = `/agents/${agentId}/events${query.toString() ? `?${query.toString()}` : ''}`;
    return this.request<AgentEventListResponse>(path, 'GET');
  }

  /**
   * Retrieves a specific event for an agent by its ID.
   * @param agentId - The unique identifier of the agent.
   * @param eventId - The unique identifier of the event.
   * @returns A `PackageResult` containing the `AgentEvent` or an error.
   */
  public async getAgentEvent(agentId: string, eventId: string): Promise<PackageResult<AgentEvent>> {
    const agentIdValidation = validateNonEmptyString(agentId, 'Agent ID');
    if (!agentIdValidation.success) {
      return { success: false, error: new ValidationError(agentIdValidation.error || 'Invalid agent ID').message };
    }
    const eventIdValidation = validateNonEmptyString(eventId, 'Event ID');
    if (!eventIdValidation.success) {
      return { success: false, error: new ValidationError(eventIdValidation.error || 'Invalid event ID').message };
    }
    return this.request<AgentEvent>(`/agents/${agentId}/events/${eventId}`, 'GET');
  }
}