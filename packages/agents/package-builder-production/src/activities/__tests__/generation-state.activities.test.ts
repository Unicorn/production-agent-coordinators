import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  saveGenerationState,
  loadGenerationState,
  getStateFilePath
} from '../generation-state.activities.js';
import type { GenerationContext } from '../../types/index.js';

describe('Generation State Activities', () => {
  const testWorkspaceRoot = '/tmp/test-workspace';
  const testSessionId = 'test-session-123';

  beforeEach(async () => {
    await fs.mkdir(testWorkspaceRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testWorkspaceRoot, { recursive: true, force: true });
  });

  it('should save and load generation context', async () => {
    const context: GenerationContext = {
      sessionId: testSessionId,
      branch: 'feat/package-generation-123',
      packageName: '@bernierllc/test-package',
      packageCategory: 'core',
      packagePath: 'packages/core/test-package',
      planPath: 'plans/packages/core/test-package.md',
      workspaceRoot: testWorkspaceRoot,
      currentPhase: 'PLANNING',
      currentStepNumber: 1,
      completedSteps: [],
      requirements: {
        testCoverageTarget: 90,
        loggerIntegration: 'not-applicable',
        neverhubIntegration: 'not-applicable',
        docsSuiteIntegration: 'planned',
        meceValidated: false,
        planApproved: false
      }
    };

    await saveGenerationState(context);
    const loaded = await loadGenerationState(testSessionId, testWorkspaceRoot);

    // Remove savedAt timestamp for comparison (it's added during save)
    const { savedAt, ...loadedWithoutTimestamp } = loaded as any;

    expect(loadedWithoutTimestamp).toEqual(context);
    expect(savedAt).toBeDefined();
  });

  it('should return null when state file does not exist', async () => {
    const loaded = await loadGenerationState('nonexistent', testWorkspaceRoot);
    expect(loaded).toBeNull();
  });
});
