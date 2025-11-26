/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { AgentCoordinatorClient, PackageResult, ClientConfig } from '../src'; // Adjust path as necessary
import { AgentCoordinatorError, AuthenticationError, ValidationError } from '../src/errors';
import { createConfig } from '../src/config';

describe('createConfig', () => {
  const MOCK_BASE_URL = 'http://localhost:3000';
  const MOCK_API_KEY = 'test-api-key';

  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.AGENT_COORDINATOR_BASE_URL;
    delete process.env.AGENT_COORDINATOR_API_KEY;
    delete process.env.AGENT_COORDINATOR_TIMEOUT_MS;
  });

  it('should create config successfully with valid user config', () => {
    const userConfig: Partial<ClientConfig> = {
      baseUrl: MOCK_BASE_URL,
      apiKey: MOCK_API_KEY,
    };
    const result = createConfig(userConfig);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.baseUrl).toBe(MOCK_BASE_URL);
    expect(result.data?.apiKey).toBe(MOCK_API_KEY);
    expect(result.data?.timeoutMs).toBe(30000); // Default timeout
  });

  it('should create config successfully with environment variables', () => {
    process.env.AGENT_COORDINATOR_BASE_URL = MOCK_BASE_URL;
    process.env.AGENT_COORDINATOR_API_KEY = MOCK_API_KEY;

    const result = createConfig();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.baseUrl).toBe(MOCK_BASE_URL);
    expect(result.data?.apiKey).toBe(MOCK_API_KEY);
    expect(result.data?.timeoutMs).toBe(30000);
  });

  it('should prioritize user config over environment variables', () => {
    process.env.AGENT_COORDINATOR_BASE_URL = 'http://env.url';
    process.env.AGENT_COORDINATOR_API_KEY = 'env-key';

    const userConfig: Partial<ClientConfig> = {
      baseUrl: MOCK_BASE_URL,
      apiKey: MOCK_API_KEY,
      timeoutMs: 5000,
    };
    const result = createConfig(userConfig);
    expect(result.success).toBe(true);
    expect(result.data?.baseUrl).toBe(MOCK_BASE_URL);
    expect(result.data?.apiKey).toBe(MOCK_API_KEY);
    expect(result.data?.timeoutMs).toBe(5000);
  });

  it('should return error if baseUrl is missing', () => {
    const userConfig: Partial<ClientConfig> = {
      apiKey: MOCK_API_KEY,
    };
    const result = createConfig(userConfig);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required configuration');
  });

  it('should return error if apiKey is missing', () => {
    const userConfig: Partial<ClientConfig> = {
      baseUrl: MOCK_BASE_URL,
    };
    const result = createConfig(userConfig);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required configuration');
  });

  it('should return error for invalid baseUrl format', () => {
    const userConfig: Partial<ClientConfig> = {
      baseUrl: 'invalid-url',
      apiKey: MOCK_API_KEY,
    };
    const result = createConfig(userConfig);
    expect(result.success).toBe(false);
    expect(result.error).toContain('`baseUrl` is not a valid URL');
  });

  it('should handle invalid timeoutMs from environment variables', () => {
    process.env.AGENT_COORDINATOR_BASE_URL = MOCK_BASE_URL;
    process.env.AGENT_COORDINATOR_API_KEY = MOCK_API_KEY;
    process.env.AGENT_COORDINATOR_TIMEOUT_MS = 'not-a-number';

    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = createConfig();
    expect(result.success).toBe(true);
    expect(result.data?.timeoutMs).toBe(30000); // Should fall back to default
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Invalid AGENT_COORDINATOR_TIMEOUT_MS'));
    spy.mockRestore();
  });

  it('should parse valid timeoutMs from environment variables', () => {
    process.env.AGENT_COORDINATOR_BASE_URL = MOCK_BASE_URL;
    process.env.AGENT_COORDINATOR_API_KEY = MOCK_API_KEY;
    process.env.AGENT_COORDINATOR_TIMEOUT_MS = '10000';

    const result = createConfig();
    expect(result.success).toBe(true);
    expect(result.data?.timeoutMs).toBe(10000);
  });
});

describe('AgentCoordinatorClient', () => {
  const mockConfig: ClientConfig = {
    baseUrl: 'http://localhost:8080',
    apiKey: 'test-api-key',
    timeoutMs: 5000,
  };

  it('should construct successfully with valid config', () => {
    const client = new AgentCoordinatorClient(mockConfig);
    expect(client).toBeInstanceOf(AgentCoordinatorClient);
  });

  it('should throw ValidationError if config baseUrl is invalid', () => {
    const invalidConfig = { ...mockConfig, baseUrl: 'invalid-url' };
    expect(() => new AgentCoordinatorClient(invalidConfig)).toThrow(ValidationError);
    expect(() => new AgentCoordinatorClient(invalidConfig)).toThrow('`baseUrl` is not a valid URL');
  });

  it('should throw AuthenticationError if config apiKey is missing', () => {
    const invalidConfig = { ...mockConfig, apiKey: '' };
    expect(() => new AgentCoordinatorClient(invalidConfig)).toThrow(AuthenticationError);
    expect(() => new AgentCoordinatorClient(invalidConfig)).toThrow('`apiKey` is required and must be a non-empty string.');
  });
});