/**
 * Test Workflow for Sample Activities
 *
 * This workflow demonstrates how to use the sample activities
 * and can be used for testing the worker infrastructure.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities/index.js';

// Configure activity options
const {
  sampleActivity,
  buildPackage,
  transformData,
  waitFor,
  logMessage,
  validateData,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 3,
  },
});

/**
 * Test workflow that exercises all sample activities
 */
export async function testSampleActivities(input: {
  testMessage: string;
}): Promise<{
  sampleResult: string;
  buildResult: any;
  transformResult: any;
  validationResult: any;
}> {
  // Log start
  await logMessage({
    level: 'info',
    message: 'Starting test workflow',
    data: { input },
  });

  // Test sample activity
  const sampleResult = await sampleActivity({
    message: input.testMessage,
  });

  // Test build package activity
  const buildResult = await buildPackage({
    packageName: 'test-package',
    version: '1.0.0',
  });

  // Test data transformation
  const transformResult = await transformData({
    data: 'hello world',
    transformation: 'uppercase',
  });

  // Test validation
  const validationResult = await validateData({
    data: 'test@example.com',
    rules: {
      required: true,
      type: 'string',
      pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$',
    },
  });

  // Wait a bit
  await waitFor({
    milliseconds: 500,
    reason: 'Testing delay activity',
  });

  // Log completion
  await logMessage({
    level: 'info',
    message: 'Test workflow completed successfully',
    data: {
      sampleResult,
      buildResult,
      transformResult,
      validationResult,
    },
  });

  return {
    sampleResult,
    buildResult,
    transformResult,
    validationResult,
  };
}

/**
 * Simple workflow for quick testing
 */
export async function simpleTestWorkflow(message: string): Promise<string> {
  await logMessage({
    level: 'info',
    message: 'Simple test workflow started',
    data: { message },
  });

  const result = await sampleActivity({ message });

  await logMessage({
    level: 'info',
    message: 'Simple test workflow completed',
    data: { result },
  });

  return result;
}
