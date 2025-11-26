/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import {
  initializeAgent,
  getAgentStatus,
  createAgentConfig
} from '../src/index';
import { AgentConfig, AgentStatus, PackageResult } from '../src/types';

describe('Agent Management Package', () => {

  // Test createAgentConfig
  describe('createAgentConfig', () => {
    test('should create a valid agent configuration', () => {
      const result: PackageResult<AgentConfig> = createAgentConfig('agent-1', 'Test Agent', true);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'agent-1', name: 'Test Agent', enabled: true });
    });

    test('should return an error for empty ID', () => {
      const result: PackageResult<AgentConfig> = createAgentConfig('', 'Test Agent', true);
      expect(result.success).toBe(false);
      expect(result.error).toBe('ID is required to create agent config.');
    });

    test('should return an error for ID with only whitespace', () => {
      const result: PackageResult<AgentConfig> = createAgentConfig('   ', 'Test Agent', true);
      expect(result.success).toBe(false);
      expect(result.error).toBe('ID is required to create agent config.');
    });

    test('should return an error for empty Name', () => {
      const result: PackageResult<AgentConfig> = createAgentConfig('agent-1', '', true);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Name is required to create agent config.');
    });

    test('should return an error for Name with only whitespace', () => {
      const result: PackageResult<AgentConfig> = createAgentConfig('agent-1', '   ', true);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Name is required to create agent config.');
    });
  });


  // Test initializeAgent
  describe('initializeAgent', () => {
    test('should successfully initialize an agent', async () => {
      const config: AgentConfig = { id: 'agent-1', name: 'Test Agent', enabled: true };
      const result: PackageResult<AgentStatus> = await initializeAgent(config);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('agent-1');
      expect(result.data?.status).toBe('online');
      expect(result.data?.lastPing).toBeInstanceOf(Date);
    });

    test('should return an error for invalid config (empty ID)', async () => {
      const config: AgentConfig = { id: '', name: 'Test Agent', enabled: true };
      const result: PackageResult<AgentStatus> = await initializeAgent(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent ID cannot be empty.');
    });

    test('should return an error for invalid config (ID with only whitespace)', async () => {
      const config: AgentConfig = { id: '   ', name: 'Test Agent', enabled: true };
      const result: PackageResult<AgentStatus> = await initializeAgent(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent ID cannot be empty.');
    });

    test('should return an error for invalid config (empty name)', async () => {
      const config: AgentConfig = { id: 'agent-1', name: '', enabled: true };
      const result: PackageResult<AgentStatus> = await initializeAgent(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent name cannot be empty.');
    });

    test('should return an error for invalid config (name with only whitespace)', async () => {
      const config: AgentConfig = { id: 'agent-1', name: '   ', enabled: true };
      const result: PackageResult<AgentStatus> = await initializeAgent(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent name cannot be empty.');
    });

    test('should handle unexpected errors during initialization', async () => {
      // Mocking initializeAgent to throw an error for testing error handling
      jest.spyOn(global, 'setTimeout').mockImplementation((_callback: (...args: unknown[]) => void, _ms: number) => {
        throw new Error('Simulated network error');
      });

      const config: AgentConfig = { id: 'agent-error', name: 'Error Agent', enabled: true };
      const result: PackageResult<AgentStatus> = await initializeAgent(config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to initialize agent: Simulated network error');

      jest.restoreAllMocks(); // Restore original setTimeout
    });

    test('should handle non-Error thrown during initialization', async () => {
      // Mocking initializeAgent to throw a non-Error object
      jest.spyOn(global, 'setTimeout').mockImplementation((_callback: (...args: unknown[]) => void, _ms: number) => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'A generic error string';
      });

      const config: AgentConfig = { id: 'agent-generic-error', name: 'Generic Error Agent', enabled: true };
      const result: PackageResult<AgentStatus> = await initializeAgent(config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to initialize agent: A generic error string');

      jest.restoreAllMocks(); // Restore original setTimeout
    });
  });

  // Test getAgentStatus
  describe('getAgentStatus', () => {
    test('should return agent status for a valid ID', async () => {
      const agentId: string = 'agent-123';
      const result: PackageResult<AgentStatus> = await getAgentStatus(agentId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(agentId);
      expect(result.data?.status).toBe('online');
      expect(result.data?.lastPing).toBeInstanceOf(Date);
    });

    test('should return an error for empty agent ID', async () => {
      const agentId: string = '';
      const result: PackageResult<AgentStatus> = await getAgentStatus(agentId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent ID cannot be empty.');
    });

    test('should return an error for agent ID with only whitespace', async () => {
      const agentId: string = '   ';
      const result: PackageResult<AgentStatus> = await getAgentStatus(agentId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent ID cannot be empty.');
    });

    test('should handle unexpected errors during status retrieval', async () => {
      // Mocking setTimeout to throw an error for testing error handling
      jest.spyOn(global, 'setTimeout').mockImplementation((_callback: (...args: unknown[]) => void, _ms: number) => {
        throw new Error('Simulated network timeout');
      });

      const agentId: string = 'agent-timeout';
      const result: PackageResult<AgentStatus> = await getAgentStatus(agentId);

      expect(result.success).toBe(false);
      expect(result.error).toContain(`Failed to get status for agent ${agentId}: Simulated network timeout`);

      jest.restoreAllMocks(); // Restore original setTimeout
    });

    test('should handle non-Error thrown during status retrieval', async () => {
      // Mocking setTimeout to throw a non-Error object
      jest.spyOn(global, 'setTimeout').mockImplementation((_callback: (...args: unknown[]) => void, _ms: number) => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw { code: 500, message: 'Internal Server Issue' };
      });

      const agentId: string = 'agent-server-error';
      const result: PackageResult<AgentStatus> = await getAgentStatus(agentId);

      expect(result.success).toBe(false);
      expect(result.error).toContain(`Failed to get status for agent ${agentId}: [object Object]`);

      jest.restoreAllMocks(); // Restore original setTimeout
    });
  });
});
```