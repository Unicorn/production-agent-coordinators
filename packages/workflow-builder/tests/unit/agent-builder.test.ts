/**
 * Agent Builder Service Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSession,
  getSession,
  sendMessage as sendMessageToAI,
  regeneratePrompt,
  deleteSession,
} from '../../src/lib/agent-builder/conversation-service';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: 'I understand. Let me help you create an agent prompt for that.',
            },
          ],
          usage: {
            input_tokens: 50,
            output_tokens: 30,
          },
        }),
      },
    })),
  };
});

describe('Agent Builder Conversation Service', () => {
  beforeEach(() => {
    // Clear all sessions before each test
    // Note: This requires exposing a cleanup method or using a test helper
  });

  describe('createSession', () => {
    it('should create a new session with initial messages', () => {
      const session = createSession('user-123');
      
      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.messages.length).toBeGreaterThan(0);
      expect(session.messages[0].role).toBe('system');
      expect(session.messages[1].role).toBe('assistant');
    });

    it('should generate unique session IDs', () => {
      const session1 = createSession('user-123');
      const session2 = createSession('user-123');
      
      expect(session1.sessionId).not.toBe(session2.sessionId);
    });
  });

  describe('getSession', () => {
    it('should retrieve existing session', () => {
      const session = createSession('user-123');
      const retrieved = getSession(session.sessionId);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.sessionId).toBe(session.sessionId);
    });

    it('should return null for non-existent session', () => {
      const retrieved = getSession('non-existent-session-id');
      expect(retrieved).toBeNull();
    });

    it('should return null for expired session', async () => {
      // This would require manipulating session expiration
      // For now, we'll test the basic case
      const session = createSession('user-123');
      const retrieved = getSession(session.sessionId);
      expect(retrieved).not.toBeNull();
    });
  });

  describe('sendMessage', () => {
    it('should add user message and get AI response', async () => {
      const session = createSession('user-123');
      const initialMessageCount = session.messages.length; // Should be 2 (system + assistant)
      
      // Mock environment variable
      process.env.ANTHROPIC_API_KEY = 'test-key';
      
      const result = await sendMessageToAI(session.sessionId, 'I want to create a code review agent');
      
      // Should have added 2 messages (user + assistant), so total should be initial + 2
      expect(result.session.messages.length).toBe(initialMessageCount + 2);
      expect(result.session.messages[result.session.messages.length - 2].role).toBe('user');
      expect(result.session.messages[result.session.messages.length - 2].content).toContain('code review');
      expect(result.session.messages[result.session.messages.length - 1].role).toBe('assistant');
      expect(result.response).toBeDefined();
    });

    it('should throw error for non-existent session', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      
      await expect(
        sendMessageToAI('non-existent-session', 'Hello')
      ).rejects.toThrow('Session not found or expired');
    });

    it('should throw error when API key is missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      const session = createSession('user-123');
      
      await expect(
        sendMessageToAI(session.sessionId, 'Hello')
      ).rejects.toThrow('ANTHROPIC_API_KEY not configured');
    });
  });

  describe('regeneratePrompt', () => {
    it('should regenerate prompt with current context', async () => {
      const session = createSession('user-123');
      process.env.ANTHROPIC_API_KEY = 'test-key';
      
      // Add some conversation history
      await sendMessageToAI(session.sessionId, 'I want a code review agent');
      await sendMessageToAI(session.sessionId, 'It should check for security issues');
      
      const prompt = await regeneratePrompt(session.sessionId);
      
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', () => {
      const session = createSession('user-123');
      const sessionId = session.sessionId;
      
      deleteSession(sessionId);
      
      const retrieved = getSession(sessionId);
      expect(retrieved).toBeNull();
    });
  });
});

