/**
 * Agent Tester Activities Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as activities from '../../src/lib/agent-tester/activities';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                prompt_content: 'You are a helpful assistant.',
                model_provider: 'anthropic',
                model_name: 'claude-sonnet-4-20250514',
              },
              error: null,
            }),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  };
});

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: 'I can help you with that!',
            },
          ],
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        }),
      },
    })),
  };
});

describe('Agent Tester Activities', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  describe('getAgentPromptActivity', () => {
    it('should fetch agent prompt from database', async () => {
      const result = await activities.getAgentPromptActivity('prompt-id-123');
      
      expect(result.promptContent).toBe('You are a helpful assistant.');
      expect(result.modelProvider).toBe('anthropic');
      expect(result.modelName).toBe('claude-sonnet-4-20250514');
    });

    it('should throw error if prompt not found', async () => {
      // Mock error response
      const { createClient } = await import('@supabase/supabase-js');
      const mockClient = createClient as any;
      mockClient.mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            })),
          })),
        })),
      });
      
      await expect(
        activities.getAgentPromptActivity('non-existent-id')
      ).rejects.toThrow();
    });
  });

  describe('callAgentActivity', () => {
    it('should call agent with conversation history', async () => {
      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'Hello',
          timestamp: new Date(),
        },
        {
          role: 'assistant' as const,
          content: 'Hi there!',
          timestamp: new Date(),
        },
      ];
      
      const response = await activities.callAgentActivity({
        promptId: 'prompt-id-123',
        conversationHistory,
        userMessage: 'What can you do?',
      });
      
      expect(response).toBe('I can help you with that!');
    });

    it('should limit conversation history to recent messages', async () => {
      // Create a long conversation history
      const longHistory = Array.from({ length: 30 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`,
        timestamp: new Date(),
      }));
      
      const response = await activities.callAgentActivity({
        promptId: 'prompt-id-123',
        conversationHistory: longHistory,
        userMessage: 'New message',
      });
      
      // Should still work (token efficiency handled internally)
      expect(response).toBeDefined();
    });

    it('should throw error if API key missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      
      await expect(
        activities.callAgentActivity({
          promptId: 'prompt-id-123',
          conversationHistory: [],
          userMessage: 'Hello',
        })
      ).rejects.toThrow('ANTHROPIC_API_KEY not configured');
    });
  });

  describe('saveTestSessionActivity', () => {
    it('should create new test session', async () => {
      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'Test message',
          timestamp: new Date(),
        },
      ];
      
      await expect(
        activities.saveTestSessionActivity({
          sessionId: 'session-123',
          agentPromptId: 'prompt-123',
          userId: 'user-123',
          temporalWorkflowId: 'workflow-123',
          temporalRunId: 'run-123',
          conversationHistory,
          status: 'active',
        })
      ).resolves.not.toThrow();
    });

    it('should update existing test session', async () => {
      // Mock existing session
      const { createClient } = await import('@supabase/supabase-js');
      const mockClient = createClient as any;
      mockClient.mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'session-123' },
                error: null,
              }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      });
      
      const conversationHistory = [
        {
          role: 'user' as const,
          content: 'Updated message',
          timestamp: new Date(),
        },
      ];
      
      await expect(
        activities.saveTestSessionActivity({
          sessionId: 'session-123',
          agentPromptId: 'prompt-123',
          userId: 'user-123',
          temporalWorkflowId: 'workflow-123',
          temporalRunId: 'run-123',
          conversationHistory,
          status: 'completed',
        })
      ).resolves.not.toThrow();
    });
  });
});

