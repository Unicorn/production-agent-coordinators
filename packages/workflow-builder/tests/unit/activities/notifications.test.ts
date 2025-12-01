/**
 * Unit Tests for Notification Activities
 * 
 * Tests notification operations with mocked HTTP requests and database calls.
 * 
 * @see planning-standards.mdc - Testing requirements
 * @see plans/ui-compiler-activities.md - Comprehensive testing strategy
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sendSlackNotification,
  updateWorkflowStatus,
  sendErrorAlert,
  sendProgressUpdate,
  type SlackNotificationInput,
  type StatusUpdateInput,
  type ErrorAlertInput,
  type ProgressUpdateInput,
} from '@/lib/activities/notifications.activities';

// Mock fetch
global.fetch = vi.fn();

describe('Notification Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================================================
  // sendSlackNotification Tests
  // ========================================================================

  describe('sendSlackNotification', () => {
    it('should send a basic Slack notification', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'ok',
      });

      const result = await sendSlackNotification({
        webhookUrl: 'https://hooks.slack.com/services/test',
        message: 'Test message',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/test',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should include channel, username, and icon in payload', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'ok',
      });

      await sendSlackNotification({
        webhookUrl: 'https://hooks.slack.com/services/test',
        message: 'Test',
        channel: '#general',
        username: 'Custom Bot',
        iconEmoji: ':rocket:',
      });

      const callArgs = (global.fetch as any).mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);

      expect(payload.channel).toBe('#general');
      expect(payload.username).toBe('Custom Bot');
      expect(payload.icon_emoji).toBe(':rocket:');
    });

    it('should include attachments in payload', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'ok',
      });

      const attachments = [
        {
          color: 'good',
          title: 'Test Title',
          text: 'Test Text',
          fields: [
            { title: 'Field1', value: 'Value1', short: true },
          ],
        },
      ];

      await sendSlackNotification({
        webhookUrl: 'https://hooks.slack.com/services/test',
        message: 'Test',
        attachments,
      });

      const callArgs = (global.fetch as any).mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);

      expect(payload.attachments).toEqual(attachments);
    });

    it('should handle Slack API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'invalid_payload',
      });

      const result = await sendSlackNotification({
        webhookUrl: 'https://hooks.slack.com/services/test',
        message: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Slack API error');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await sendSlackNotification({
        webhookUrl: 'https://hooks.slack.com/services/test',
        message: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  // ========================================================================
  // updateWorkflowStatus Tests
  // ========================================================================

  describe('updateWorkflowStatus', () => {
    it('should validate and accept valid status update', async () => {
      const result = await updateWorkflowStatus({
        executionId: 'exec-123',
        status: 'running',
        message: 'Processing...',
        progress: 50,
      });

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
    });

    it('should accept all valid status values', async () => {
      const statuses = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;
      
      for (const status of statuses) {
        const result = await updateWorkflowStatus({
          executionId: 'exec-123',
          status,
        });

        expect(result.success).toBe(true);
        expect(result.updated).toBe(true);
      }
    });

    it('should reject invalid status', async () => {
      const result = await updateWorkflowStatus({
        executionId: 'exec-123',
        status: 'invalid' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status');
    });

    it('should reject missing executionId', async () => {
      const result = await updateWorkflowStatus({
        executionId: '',
        status: 'running',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('executionId is required');
    });

    it('should reject progress outside 0-100 range', async () => {
      const result1 = await updateWorkflowStatus({
        executionId: 'exec-123',
        status: 'running',
        progress: -1,
      });

      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Progress must be between 0 and 100');

      const result2 = await updateWorkflowStatus({
        executionId: 'exec-123',
        status: 'running',
        progress: 101,
      });

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Progress must be between 0 and 100');
    });

    it('should accept progress at boundaries', async () => {
      const result1 = await updateWorkflowStatus({
        executionId: 'exec-123',
        status: 'running',
        progress: 0,
      });

      expect(result1.success).toBe(true);

      const result2 = await updateWorkflowStatus({
        executionId: 'exec-123',
        status: 'running',
        progress: 100,
      });

      expect(result2.success).toBe(true);
    });

    it('should include metadata in status update', async () => {
      const result = await updateWorkflowStatus({
        executionId: 'exec-123',
        status: 'running',
        metadata: {
          step: 'compiling',
          filesProcessed: 10,
        },
      });

      expect(result.success).toBe(true);
    });
  });

  // ========================================================================
  // sendErrorAlert Tests
  // ========================================================================

  describe('sendErrorAlert', () => {
    it('should create error alert without Slack notification', async () => {
      const result = await sendErrorAlert({
        executionId: 'exec-123',
        error: 'Test error',
        severity: 'medium',
      });

      expect(result.success).toBe(true);
      expect(result.alertId).toBeDefined();
      expect(result.slackNotified).toBe(false);
    });

    it('should send Slack notification when requested', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'ok',
      });

      const result = await sendErrorAlert({
        executionId: 'exec-123',
        error: 'Test error',
        severity: 'high',
        notifySlack: true,
        slackWebhookUrl: 'https://hooks.slack.com/services/test',
      });

      expect(result.success).toBe(true);
      expect(result.alertId).toBeDefined();
      expect(result.slackNotified).toBe(true);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle Slack notification failure gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'error',
      });

      const result = await sendErrorAlert({
        executionId: 'exec-123',
        error: 'Test error',
        notifySlack: true,
        slackWebhookUrl: 'https://hooks.slack.com/services/test',
      });

      expect(result.success).toBe(true);
      expect(result.alertId).toBeDefined();
      expect(result.slackNotified).toBe(false);
    });

    it('should include context in Slack notification', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => 'ok',
      });

      await sendErrorAlert({
        executionId: 'exec-123',
        error: 'Test error',
        severity: 'critical',
        context: {
          workflowId: 'wf-456',
          step: 'compilation',
        },
        notifySlack: true,
        slackWebhookUrl: 'https://hooks.slack.com/services/test',
      });

      const callArgs = (global.fetch as any).mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);
      const attachment = payload.attachments[0];

      expect(attachment.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Execution ID', value: 'exec-123' }),
          expect.objectContaining({ title: 'Severity', value: 'critical' }),
          expect.objectContaining({ title: 'workflowId', value: 'wf-456' }),
          expect.objectContaining({ title: 'step', value: 'compilation' }),
        ])
      );
    });

    it('should use appropriate color based on severity', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'ok',
      });

      const severities = [
        { severity: 'critical' as const, expectedColor: 'danger' },
        { severity: 'high' as const, expectedColor: 'warning' },
        { severity: 'medium' as const, expectedColor: 'good' },
        { severity: 'low' as const, expectedColor: 'good' },
      ];

      for (const { severity, expectedColor } of severities) {
        await sendErrorAlert({
          executionId: 'exec-123',
          error: 'Test',
          severity,
          notifySlack: true,
          slackWebhookUrl: 'https://hooks.slack.com/services/test',
        });

        const callArgs = (global.fetch as any).mock.calls.pop();
        const payload = JSON.parse(callArgs[1].body);
        expect(payload.attachments[0].color).toBe(expectedColor);
      }
    });
  });

  // ========================================================================
  // sendProgressUpdate Tests
  // ========================================================================

  describe('sendProgressUpdate', () => {
    it('should send progress update successfully', async () => {
      const result = await sendProgressUpdate({
        executionId: 'exec-123',
        step: 'Compiling',
        progress: 50,
        message: 'Halfway done',
      });

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
    });

    it('should reject missing executionId', async () => {
      const result = await sendProgressUpdate({
        executionId: '',
        step: 'Test',
        progress: 50,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('executionId is required');
    });

    it('should reject progress outside 0-100 range', async () => {
      const result1 = await sendProgressUpdate({
        executionId: 'exec-123',
        step: 'Test',
        progress: -1,
      });

      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Progress must be between 0 and 100');

      const result2 = await sendProgressUpdate({
        executionId: 'exec-123',
        step: 'Test',
        progress: 101,
      });

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Progress must be between 0 and 100');
    });

    it('should include estimated time remaining', async () => {
      const result = await sendProgressUpdate({
        executionId: 'exec-123',
        step: 'Processing',
        progress: 75,
        estimatedTimeRemaining: 5000,
      });

      expect(result.success).toBe(true);
    });

    it('should use step as message if message not provided', async () => {
      const result = await sendProgressUpdate({
        executionId: 'exec-123',
        step: 'Custom Step Name',
        progress: 25,
      });

      expect(result.success).toBe(true);
    });
  });
});

