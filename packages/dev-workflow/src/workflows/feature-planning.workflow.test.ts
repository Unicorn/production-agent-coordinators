import { describe, it, expect } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { userResponseSignal, planApprovalSignal } from './feature-planning.workflow';
import path from 'path';

describe('FeaturePlanningWorkflow - Conversational', () => {
  it('should gather requirements through Q&A', { timeout: 15000 }, async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();

    const { client } = testEnv;
    const taskQueue = 'test-queue';

    // Mock activities to avoid bundling issues with Slack dependencies
    const mockActivities = {
      createBrainGridREQ: async () => 'req-test-123',
      createBrainGridTasks: async () => {},
      buildDependencyTree: async () => ({
        reqId: 'req-test-123',
        tasks: new Map(),
        layers: [[]]
      }),
      sendThreadMessage: async () => ({ success: true, ts: '1234567890.123456' }),
      askQuestion: async () => ({ messageTs: '1234567890.123456', channel: 'C12345' })
    };

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: path.join(__dirname, 'feature-planning.workflow.ts'),
      activities: mockActivities
    });

    // Start the worker
    await worker.runUntil(async () => {
      const handle = await client.workflow.start('FeaturePlanningWorkflow', {
        taskQueue,
        workflowId: 'test-planning-1',
        args: [{
          featureRequest: 'Initial request',
          repoPath: '/test/repo',
          slackChannel: 'C12345',
          slackThreadTs: '1234567890.000000'
        }]
      });

      // Wait a bit for workflow to start
      await testEnv.sleep('100ms');

      // Simulate user responses to questions
      await handle.signal(userResponseSignal, {
        response: 'User authentication system',
        timestamp: new Date().toISOString(),
        userId: 'U12345'
      });

      await testEnv.sleep('100ms');

      await handle.signal(userResponseSignal, {
        response: 'Web application users',
        timestamp: new Date().toISOString(),
        userId: 'U12345'
      });

      await testEnv.sleep('100ms');

      await handle.signal(userResponseSignal, {
        response: 'Must use OAuth2',
        timestamp: new Date().toISOString(),
        userId: 'U12345'
      });

      await testEnv.sleep('100ms');

      // Approve the plan
      await handle.signal(planApprovalSignal, {
        approved: true,
        timestamp: new Date().toISOString()
      });

      const result = await handle.result();

      expect(result.success).toBe(true);
      expect(result.reqId).toBeDefined();
      expect(result.reqId).toBe('req-test-123');
    });

    await testEnv.teardown();
  });

  it('should work without Slack integration (backward compatible)', { timeout: 10000 }, async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();

    const { client } = testEnv;
    const taskQueue = 'test-queue';

    // Mock activities
    const mockActivities = {
      createBrainGridREQ: async () => 'req-test-456',
      createBrainGridTasks: async () => {},
      buildDependencyTree: async () => ({
        reqId: 'req-test-456',
        tasks: new Map(),
        layers: [[], []]
      }),
      sendThreadMessage: async () => ({ success: true, ts: '1234567890.123456' }),
      askQuestion: async () => ({ messageTs: '1234567890.123456', channel: 'C12345' })
    };

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: path.join(__dirname, 'feature-planning.workflow.ts'),
      activities: mockActivities
    });

    await worker.runUntil(async () => {
      const handle = await client.workflow.start('FeaturePlanningWorkflow', {
        taskQueue,
        workflowId: 'test-planning-2',
        args: [{
          featureRequest: 'Add email notifications',
          repoPath: '/test/repo'
          // No slackChannel or slackThreadTs - should skip Slack interaction
        }]
      });

      const result = await handle.result();

      expect(result.success).toBe(true);
      expect(result.reqId).toBe('req-test-456');
      expect(result.taskCount).toBe(3);
    });

    await testEnv.teardown();
  });

  it('should handle plan rejection with feedback', { timeout: 15000 }, async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();

    const { client } = testEnv;
    const taskQueue = 'test-queue';

    // Mock activities to avoid bundling issues with Slack dependencies
    const mockActivities = {
      createBrainGridREQ: async () => 'req-test-789',
      createBrainGridTasks: async () => {},
      buildDependencyTree: async () => ({
        reqId: 'req-test-789',
        tasks: new Map(),
        layers: [[]]
      }),
      sendThreadMessage: async () => ({ success: true, ts: '1234567890.123456' }),
      askQuestion: async () => ({ messageTs: '1234567890.123456', channel: 'C12345' })
    };

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: path.join(__dirname, 'feature-planning.workflow.ts'),
      activities: mockActivities
    });

    // Start the worker
    await worker.runUntil(async () => {
      const handle = await client.workflow.start('FeaturePlanningWorkflow', {
        taskQueue,
        workflowId: 'test-planning-rejection',
        args: [{
          featureRequest: 'Initial request',
          repoPath: '/test/repo',
          slackChannel: 'C12345',
          slackThreadTs: '1234567890.000000'
        }]
      });

      // Wait a bit for workflow to start
      await testEnv.sleep('100ms');

      // Simulate user responses to questions
      await handle.signal(userResponseSignal, {
        response: 'Feature A',
        timestamp: new Date().toISOString(),
        userId: 'U12345'
      });

      await testEnv.sleep('100ms');

      await handle.signal(userResponseSignal, {
        response: 'Users B',
        timestamp: new Date().toISOString(),
        userId: 'U12345'
      });

      await testEnv.sleep('100ms');

      await handle.signal(userResponseSignal, {
        response: 'No constraints',
        timestamp: new Date().toISOString(),
        userId: 'U12345'
      });

      await testEnv.sleep('100ms');

      // Reject the plan with feedback
      await handle.signal(planApprovalSignal, {
        approved: false,
        feedback: 'This is not what I wanted. Please focus on X instead of Y.',
        timestamp: new Date().toISOString()
      });

      const result = await handle.result();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Plan rejected by user');
      expect(result.feedback).toBe('This is not what I wanted. Please focus on X instead of Y.');
      expect(result.reqId).toBeUndefined();
      expect(result.taskCount).toBeUndefined();
    });

    await testEnv.teardown();
  });
});
