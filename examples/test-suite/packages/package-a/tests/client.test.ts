/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { AgentCoordinatorClient, ClientConfig, CreateAgentInput, UpdateAgentInput, SendMessageInput, AgentListResponse, AgentMessageListResponse, AgentEventListResponse, Agent } from '../src';
import { AuthenticationError, NetworkError, NotFoundError, ValidationError } from '../src/errors';
import 'whatwg-fetch'; // Polyfill fetch for Node.js if needed, or mock it

// Mock the global fetch function
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('AgentCoordinatorClient API Methods', () => {
  const mockClientConfig: ClientConfig = {
    baseUrl: 'http://localhost:8080',
    apiKey: 'test-api-key',
    timeoutMs: 1000,
  };
  let client: AgentCoordinatorClient;

  beforeEach(() => {
    client = new AgentCoordinatorClient(mockClientConfig);
    mockFetch.mockClear();
  });

  // Helper to create a mock response
  const createMockResponse = (status: number, body: unknown = {}, ok: boolean = true) => ({
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)), // For error bodies
  });

  // --- Agents API ---

  describe('listAgents', () => {
    it('should fetch a list of agents successfully', async () => {
      const mockAgents: Agent[] = [{
        id: 'agent1', name: 'Agent Alpha', status: 'active',
        createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z',
      }];
      const mockResponseData: AgentListResponse = {
        agents: mockAgents, total: 1, offset: 0, limit: 10,
      };
      mockFetch.mockResolvedValue(createMockResponse(200, mockResponseData));

      const result = await client.listAgents();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponseData);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockClientConfig.baseUrl}/agents`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should fetch a list of agents with options', async () => {
      const mockAgents: Agent[] = [{
        id: 'agent1', name: 'Agent Alpha', status: 'active',
        createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z',
      }];
      const mockResponseData: AgentListResponse = {
        agents: mockAgents, total: 1, offset: 5, limit: 20,
      };
      mockFetch.mockResolvedValue(createMockResponse(200, mockResponseData));

      const options = { offset: 5, limit: 20, status: 'active' };
      const result = await client.listAgents(options);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponseData);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockClientConfig.baseUrl}/agents?offset=5&limit=20&status=active`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should return error for invalid offset option', async () => {
      const result = await client.listAgents({ offset: -1 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Offset must be a non-negative integer.');
    });

    it('should return error for invalid limit option', async () => {
      const result = await client.listAgents({ limit: -1 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Limit must be a non-negative integer.');
    });

    it('should return error for invalid status option', async () => {
      const result = await client.listAgents({ status: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Status must be a non-empty string.');
    });

    it('should handle API error when listing agents', async () => {
      mockFetch.mockResolvedValue(createMockResponse(500, { message: 'Internal Server Error' }, false));

      const result = await client.listAgents();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Server Error');
    });

    it('should handle network error when listing agents', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await client.listAgents();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network request failed');
    });
  });

  describe('createAgent', () => {
    const newAgentInput: CreateAgentInput = { name: 'New Agent', status: 'pending' };
    const mockCreatedAgent: Agent = {
      id: 'agent2', ...newAgentInput,
      createdAt: '2023-01-02T00:00:00Z', updatedAt: '2023-01-02T00:00:00Z',
    };

    it('should create an agent successfully', async () => {
      mockFetch.mockResolvedValue(createMockResponse(201, mockCreatedAgent));

      const result = await client.createAgent(newAgentInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreatedAgent);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockClientConfig.baseUrl}/agents`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newAgentInput),
        }),
      );
    });

    it('should return error for empty agent name', async () => {
      const result = await client.createAgent({ ...newAgentInput, name: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent name must be a non-empty string.');
    });

    it('should return error for empty agent status', async () => {
      const result = await client.createAgent({ ...newAgentInput, status: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent status must be a non-empty string.');
    });

    it('should handle API validation error when creating agent', async () => {
      mockFetch.mockResolvedValue(createMockResponse(400, { message: 'Validation Failed' }, false));

      const result = await client.createAgent(newAgentInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Bad Request: Validation Failed');
    });
  });

  describe('getAgent', () => {
    const existingAgentId = 'agent1';
    const mockAgent: Agent = {
      id: existingAgentId, name: 'Agent Alpha', status: 'active',
      createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-01T00:00:00Z',
    };

    it('should retrieve an agent successfully', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, mockAgent));

      const result = await client.getAgent(existingAgentId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAgent);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockClientConfig.baseUrl}/agents/${existingAgentId}`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should return error for empty agent ID', async () => {
      const result = await client.getAgent('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent ID must be a non-empty string.');
    });

    it('should handle 404 error when agent not found', async () => {
      mockFetch.mockResolvedValue(createMockResponse(404, { message: 'Agent not found' }, false));

      const result = await client.getAgent('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Resource Not Found');
    });
  });

  describe('updateAgent', () => {
    const agentIdToUpdate = 'agent1';
    const updateInput: UpdateAgentInput = { status: 'inactive', description: 'Updated description' };
    const mockUpdatedAgent: Agent = {
      id: agentIdToUpdate, name: 'Agent Alpha', status: 'inactive', description: 'Updated description',
      createdAt: '2023-01-01T00:00:00Z', updatedAt: '2023-01-03T00:00:00Z',
    };

    it('should update an agent successfully', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, mockUpdatedAgent));

      const result = await client.updateAgent(agentIdToUpdate, updateInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedAgent);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockClientConfig.baseUrl}/agents/${agentIdToUpdate}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateInput),
        }),
      );
    });

    it('should return error for empty agent ID', async () => {
      const result = await client.updateAgent('', updateInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent ID must be a non-empty string.');
    });

    it('should return error for empty update input', async () => {
      const result = await client.updateAgent(agentIdToUpdate, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Update input cannot be empty.');
    });

    it('should return error for invalid name in update input', async () => {
      const result = await client.updateAgent(agentIdToUpdate, { name: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent name must be a non-empty string.');
    });

    it('should return error for invalid status in update input', async () => {
      const result = await client.updateAgent(agentIdToUpdate, { status: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent status must be a non-empty string.');
    });

    it('should handle API authentication error when updating agent', async () => {
      mockFetch.mockResolvedValue(createMockResponse(401, { message: 'Unauthorized' }, false));

      const result = await client.updateAgent(agentIdToUpdate, updateInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication Failed');
    });
  });

  describe('deleteAgent', () => {
    const agentIdToDelete = 'agent1';

    it('should delete an agent successfully', async () => {
      mockFetch.mockResolvedValue(createMockResponse(204, null, true)); // No content for 204

      const result = await client.deleteAgent(agentIdToDelete);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockClientConfig.baseUrl}/agents/${agentIdToDelete}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('should return error for empty agent ID', async () => {
      const result = await client.deleteAgent('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent ID must be a non-empty string.');
    });

    it('should handle API not found error when deleting non-existent agent', async () => {
      mockFetch.mockResolvedValue(createMockResponse(404, { message: 'Agent not found' }, false));

      const result = await client.deleteAgent('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Resource Not Found');
    });
  });

  // --- Messages API ---

  describe('sendMessageToAgent', () => {
    const agentId = 'agent1';
    const messageInput: SendMessageInput = { content: 'Hello Agent!', metadata: { type: 'greeting' } };
    const mockSentMessage = {
      id: 'msg1', agentId, ...messageInput,
      createdAt: '2023-01-04T00:00:00Z',
    };

    it('should send a message successfully', async () => {
      mockFetch.mockResolvedValue(createMockResponse(201, mockSentMessage));

      const result = await client.sendMessageToAgent(agentId, messageInput);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSentMessage);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockClientConfig.baseUrl}/agents/${agentId}/messages`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(messageInput),
        }),
      );
    });

    it('should return error for empty agent ID', async () => {
      const result = await client.sendMessageToAgent('', messageInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent ID must be a non-empty string.');
    });

    it('should return error for empty message content', async () => {
      const result = await client.sendMessageToAgent(agentId, { content: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Message content must be a non-empty string.');
    });

    it('should handle API validation error when sending message', async () => {
      mockFetch.mockResolvedValue(createMockResponse(400, { message: 'Invalid message data' }, false));

      const result = await client.sendMessageToAgent(agentId, messageInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Bad Request: Invalid message data');
    });
  });

  describe('listAgentMessages', () => {
    const agentId = 'agent1';
    const mockMessages = [{
      id: 'msg1', agentId, content: 'Hi', createdAt: '2023-01-04T00:00:00Z',
    }];
    const mockResponseData: AgentMessageListResponse = {
      messages: mockMessages, total: 1, offset: 0, limit: 10,
    };

    it('should fetch a list of messages for an agent successfully', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, mockResponseData));

      const result = await client.listAgentMessages(agentId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponseData);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockClientConfig.baseUrl}/agents/${agentId}/messages`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should fetch a list of messages with options', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, mockResponseData));
      const options = { offset: 5, limit: 20, keyword: 'test' };
      const result = await client.listAgentMessages(agentId, options);
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockClientConfig.baseUrl}/agents/${agentId}/messages?offset=5&limit=20&keyword=test`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should return error for empty agent ID', async () => {
      const result = await client.listAgentMessages('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent ID must be a non-empty string.');
    });

    it('should return error for invalid offset option', async () => {
      const result = await client.listAgentMessages(agentId, { offset: -1 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Offset must be a non-negative integer.');
    });

    it('should return error for invalid limit option', async () => {
      const result = await client.listAgentMessages(agentId, { limit: -1 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Limit must be a non-negative integer.');
    });

    it('should return error for invalid keyword option', async () => {
      const result = await client.listAgentMessages(agentId, { keyword: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Keyword must be a non-empty string.');
    });
  });

  describe('getAgentMessage', () => {
    const agentId = 'agent1';
    const messageId = 'msg1';
    const mockMessage = {
      id: messageId, agentId, content: 'Hi', createdAt: '2023-01-04T00:00:00Z',
    };

    it('should retrieve a specific message for an agent successfully', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, mockMessage));

      const result = await client.getAgentMessage(agentId, messageId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMessage);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockClientConfig.baseUrl}/agents/${agentId}/messages/${messageId}`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should return error for empty agent ID', async () => {
      const result = await client.getAgentMessage('', messageId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent ID must be a non-empty string.');
    });

    it('should return error for empty message ID', async () => {
      const result = await client.getAgentMessage(agentId, '');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Message ID must be a non-empty string.');
    });
  });

  // --- Events API ---

  describe('listAgentEvents', () => {
    const agentId = 'agent1';
    const mockEvents = [{
      id: 'event1', agentId, type: 'agent_created', payload: {}, createdAt: '2023-01-01T00:00:00Z',
    }];
    const mockResponseData: AgentEventListResponse = {
      events: mockEvents, total: 1, offset: 0, limit: 10,
    };

    it('should fetch a list of events for an agent successfully', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, mockResponseData));

      const result = await client.listAgentEvents(agentId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponseData);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockClientConfig.baseUrl}/agents/${agentId}/events`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should fetch a list of events with options', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, mockResponseData));
      const options = { offset: 5, limit: 20, type: 'message_sent' };
      const result = await client.listAgentEvents(agentId, options);
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockClientConfig.baseUrl}/agents/${agentId}/events?offset=5&limit=20&type=message_sent`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should return error for empty agent ID', async () => {
      const result = await client.listAgentEvents('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent ID must be a non-empty string.');
    });

    it('should return error for invalid offset option', async () => {
      const result = await client.listAgentEvents(agentId, { offset: -1 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Offset must be a non-negative integer.');
    });

    it('should return error for invalid limit option', async () => {
      const result = await client.listAgentEvents(agentId, { limit: -1 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Limit must be a non-negative integer.');
    });

    it('should return error for invalid type option', async () => {
      const result = await client.listAgentEvents(agentId, { type: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Type must be a non-empty string.');
    });
  });

  describe('getAgentEvent', () => {
    const agentId = 'agent1';
    const eventId = 'event1';
    const mockEvent = {
      id: eventId, agentId, type: 'agent_created', payload: {}, createdAt: '2023-01-01T00:00:00Z',
    };

    it('should retrieve a specific event for an agent successfully', async () => {
      mockFetch.mockResolvedValue(createMockResponse(200, mockEvent));

      const result = await client.getAgentEvent(agentId, eventId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEvent);
      expect(mockFetch).toHaveBeenCalledWith(
        `${mockClientConfig.baseUrl}/agents/${agentId}/events/${eventId}`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should return error for empty agent ID', async () => {
      const result = await client.getAgentEvent('', eventId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent ID must be a non-empty string.');
    });

    it('should return error for empty event ID', async () => {
      const result = await client.getAgentEvent(agentId, '');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Event ID must be a non-empty string.');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle fetch rejecting with a non-TypeError', async () => {
      mockFetch.mockRejectedValue(new Error('Something unexpected'));

      const result = await client.listAgents();
      expect(result.success).toBe(false);
      expect(result.error).toContain('An unexpected error occurred');
      expect(result.error).toContain('Something unexpected');
    });

    it('should handle fetch rejecting with an unknown type', async () => {
      mockFetch.mockRejectedValue('just a string error'); // Simulating a non-Error rejection

      const result = await client.listAgents();
      expect(result.success).toBe(false);
      expect(result.error).toContain('An unknown error occurred');
    });

    it('should handle timeout when fetching', async () => {
      // Mock an AbortController signal being aborted
      mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
        return new Promise((resolve, reject) => {
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              reject(new DOMException('The user aborted a request.', 'AbortError'));
            });
          }
          // Simulate a long request that would time out
          // For this test, we specifically want to simulate the rejection by abort signal.
          // The actual client setup creates a timeout, but we mock fetch directly here.
          // This test specifically verifies the error handling when an abort happens.
        });
      });

      const result = await client.listAgents();
      // Expecting a network error due to abort, which implies timeout
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network request failed');
    });

    it('should handle 401 Unauthorized errors', async () => {
      mockFetch.mockResolvedValue(createMockResponse(401, { message: 'Auth Required' }, false));
      const result = await client.listAgents();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication Failed');
    });

    it('should handle 403 Forbidden errors', async () => {
      mockFetch.mockResolvedValue(createMockResponse(403, { message: 'Forbidden' }, false));
      const result = await client.listAgents();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication Failed');
    });

    it('should handle 429 Too Many Requests errors', async () => {
      mockFetch.mockResolvedValue(createMockResponse(429, { message: 'Rate Limit Exceeded' }, false));
      const result = await client.listAgents();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too Many Requests');
    });

    it('should handle general HTTP error responses with unparseable body', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockRejectedValue(new Error('Not JSON')),
        text: jest.fn().mockResolvedValue('Plain text error'),
      });
      const result = await client.listAgents();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Bad Request');
      expect(result.error).toContain('Plain text error');
    });
  });
});
```