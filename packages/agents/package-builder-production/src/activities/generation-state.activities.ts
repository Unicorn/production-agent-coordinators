/**
 * Generation State Management Activities
 *
 * Persist and recover generation context for turn-based package building.
 * State files stored in `.generation-state/` directory in workspace root
 * for durability across workflow restarts.
 *
 * State Persistence Strategy:
 * - Each session gets a unique JSON file: `.generation-state/${sessionId}.json`
 * - State saved after every phase completion
 * - State includes completed steps, current phase, and recovery information
 * - State files enable resuming from failures without data loss
 *
 * File Format:
 * ```json
 * {
 *   "sessionId": "gen-1732198765432",
 *   "currentPhase": "TYPES",
 *   "currentStepNumber": 3,
 *   "completedSteps": [...],
 *   "lastSuccessfulCommit": "abc123",
 *   "savedAt": "2024-11-21T16:47:30.000Z"
 * }
 * ```
 *
 * @example Save state after phase completion
 * ```typescript
 * const context: GenerationContext = {
 *   sessionId: 'gen-1732198765432',
 *   currentPhase: 'FOUNDATION',
 *   // ... other fields
 * };
 * await saveGenerationState(context);
 * ```
 *
 * @example Load state to resume workflow
 * ```typescript
 * const context = await loadGenerationState('gen-1732198765432', '/workspace');
 * if (context) {
 *   console.log('Resuming from:', context.currentPhase);
 *   // Resume workflow from this context
 * }
 * ```
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
 * Creates `.generation-state/` directory if needed.
 * Atomically writes state file with timestamp.
 *
 * State file location: `${workspaceRoot}/.generation-state/${sessionId}.json`
 *
 * Call this function:
 * - After initializing new context
 * - After recording each completed step
 * - After marking context as failed
 * - Whenever context is updated
 *
 * @param context - Generation context to save
 * @throws Error if directory creation fails
 * @throws Error if file write fails
 *
 * @example
 * ```typescript
 * context.currentPhase = 'TYPES';
 * await saveGenerationState(context);
 * // State now persisted to disk
 * ```
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
 * Use this to resume a workflow from a previous session.
 * Returns `null` if session doesn't exist (not an error).
 *
 * @param sessionId - Session ID to load (e.g., 'gen-1732198765432')
 * @param workspaceRoot - Workspace root directory
 * @returns Loaded context or null if not found
 * @throws Error if file exists but is invalid JSON
 * @throws Error if file exists but read fails (permissions, etc.)
 *
 * @example
 * ```typescript
 * const context = await loadGenerationState('gen-1732198765432', '/workspace');
 * if (context) {
 *   console.log('Found session, resuming from:', context.currentPhase);
 * } else {
 *   console.log('Session not found, starting new generation');
 * }
 * ```
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
 * Call this after each step within a phase completes successfully.
 *
 * Automatically:
 * - Adds timestamp to step
 * - Appends step to completedSteps array
 * - Increments currentStepNumber
 * - Saves updated context to disk
 *
 * @param context - Current generation context (modified in place)
 * @param step - Completed step details (without timestamp)
 * @throws Error if state save fails
 *
 * @example
 * ```typescript
 * await recordCompletedStep(context, {
 *   stepNumber: 2,
 *   phase: 'FOUNDATION',
 *   description: 'Generated configuration files',
 *   files: ['package.json', 'tsconfig.json']
 * });
 * // Context now has step recorded and saved to disk
 * ```
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
 * Call this when a phase fails to record failure details for debugging
 * and recovery. Increments retry count for tracking recovery attempts.
 *
 * @param context - Current generation context (modified in place)
 * @param failedStep - Step number that failed
 * @param error - Error message describing the failure
 * @throws Error if state save fails
 *
 * @example
 * ```typescript
 * const result = await executeTypesPhase(context);
 * if (!result.success) {
 *   await markContextFailed(context, context.currentStepNumber, result.error);
 *   throw new Error(`Phase failed: ${result.error}`);
 * }
 * ```
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
