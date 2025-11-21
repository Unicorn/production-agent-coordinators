/**
 * Generation State Management Activities
 *
 * Persist and recover generation context for turn-based package building.
 * State files stored in workspace root for durability across workflow restarts.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { GenerationContext, GenerationStep } from '../types/index.js';

/**
 * Get state file path for session
 *
 * @param sessionId - Unique session identifier
 * @param workspaceRoot - Workspace root directory
 * @returns Absolute path to state file
 */
export function getStateFilePath(sessionId: string, workspaceRoot: string): string {
  return path.join(workspaceRoot, '.generation-state', `${sessionId}.json`);
}

/**
 * Save generation context to disk
 *
 * Creates .generation-state directory if needed.
 * Atomically writes state file with timestamp.
 *
 * @param context - Generation context to save
 */
export async function saveGenerationState(context: GenerationContext): Promise<void> {
  const stateDir = path.join(context.workspaceRoot, '.generation-state');
  await fs.mkdir(stateDir, { recursive: true });

  const stateFile = getStateFilePath(context.sessionId, context.workspaceRoot);

  const stateData = {
    ...context,
    savedAt: new Date().toISOString()
  };

  await fs.writeFile(stateFile, JSON.stringify(stateData, null, 2), 'utf-8');

  console.log(`[StateManager] Saved context for session ${context.sessionId}`);
  console.log(`[StateManager] Phase: ${context.currentPhase}, Step: ${context.currentStepNumber}`);
}

/**
 * Load generation context from disk
 *
 * @param sessionId - Session to load
 * @param workspaceRoot - Workspace root directory
 * @returns Loaded context or null if not found
 */
export async function loadGenerationState(
  sessionId: string,
  workspaceRoot: string
): Promise<GenerationContext | null> {
  const stateFile = getStateFilePath(sessionId, workspaceRoot);

  try {
    const data = await fs.readFile(stateFile, 'utf-8');
    const parsed = JSON.parse(data);

    console.log(`[StateManager] Loaded context for session ${sessionId}`);
    console.log(`[StateManager] Phase: ${parsed.currentPhase}, Step: ${parsed.currentStepNumber}`);

    return parsed as GenerationContext;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Record completed step in context
 *
 * Updates context with step completion and saves to disk.
 *
 * @param context - Current generation context
 * @param step - Completed step details
 */
export async function recordCompletedStep(
  context: GenerationContext,
  step: Omit<GenerationStep, 'timestamp'>
): Promise<void> {
  const completedStep: GenerationStep = {
    ...step,
    timestamp: Date.now()
  };

  context.completedSteps.push(completedStep);
  context.currentStepNumber = step.stepNumber + 1;

  await saveGenerationState(context);

  console.log(`[StateManager] Recorded step ${step.stepNumber}: ${step.description}`);
}

/**
 * Mark context as failed with recovery info
 *
 * @param context - Current generation context
 * @param failedStep - Step number that failed
 * @param error - Error message
 */
export async function markContextFailed(
  context: GenerationContext,
  failedStep: number,
  error: string
): Promise<void> {
  const retryCount = context.failureRecovery?.retryCount ?? 0;

  context.failureRecovery = {
    failedStep,
    error,
    retryCount: retryCount + 1
  };

  await saveGenerationState(context);

  console.log(`[StateManager] Marked failed at step ${failedStep}, retry ${retryCount + 1}`);
}
