/**
 * Model Selection Logic for Claude CLI
 * 
 * Routes tasks to appropriate Claude models (Opus/Sonnet/Haiku) based on complexity
 * to optimize cost while maintaining quality.
 */

import type { BuildTask } from './cli-agent.activities.js';

export type ClaudeModel = 'opus' | 'sonnet' | 'haiku';

export interface ModelSelection {
  model: ClaudeModel;
  thinkingKeyword?: string; // 'think', 'think hard', 'ultrathink'
  permissionMode?: 'plan' | 'acceptEdits' | 'full';
}

/**
 * Select appropriate Claude model based on task type
 * 
 * Model Routing Table:
 * - Architecture planning → Opus with 'think hard' (deep reasoning)
 * - Scaffolding → Sonnet (structured, predictable)
 * - Implementation → Sonnet (code generation sweet spot)
 * - Test writing → Sonnet (comprehensive coverage)
 * - Lint/ESLint fixes → Haiku (mechanical, pattern-based)
 * - Type fixes → Haiku (simple type annotations)
 * - Surface repairs → Sonnet (single-file fixes)
 * - Cross-file repairs → Opus with 'think' (architectural issues)
 * - Documentation → Haiku (simple text generation)
 */
export function selectClaudeModel(task: BuildTask, errorType?: string): ModelSelection {
  // Architecture and planning tasks
  if (task === 'scaffold' && errorType === undefined) {
    // Initial scaffolding - use Sonnet (cost-effective for structured work)
    return {
      model: 'sonnet',
      permissionMode: 'acceptEdits',
    };
  }

  // Implementation tasks
  if (task === 'implement') {
    return {
      model: 'sonnet',
      permissionMode: 'acceptEdits',
    };
  }

  // Test writing
  if (task === 'test') {
    return {
      model: 'sonnet',
      permissionMode: 'acceptEdits',
    };
  }

  // Documentation
  if (task === 'document') {
    return {
      model: 'haiku',
      permissionMode: 'acceptEdits',
    };
  }

  // Fix/repair tasks - route based on error type
  if (task === 'fix') {
    // Mechanical fixes → Haiku
    if (errorType === 'ESLINT_ERROR' || errorType === 'LINT_ERROR') {
      return {
        model: 'haiku',
        permissionMode: 'acceptEdits',
      };
    }

    // Single-file type fixes → Haiku
    if (errorType === 'TSC_ERROR' && !errorType.includes('multiple files')) {
      return {
        model: 'haiku',
        permissionMode: 'acceptEdits',
      };
    }

    // Cross-file architectural issues → Opus with thinking
    if (
      errorType?.includes('circular dependency') ||
      errorType?.includes('module type mismatch') ||
      errorType?.includes('design inconsistency')
    ) {
      return {
        model: 'opus',
        thinkingKeyword: 'think hard',
        permissionMode: 'acceptEdits',
      };
    }

    // Complex logic fixes → Sonnet (default for fixes)
    return {
      model: 'sonnet',
      permissionMode: 'acceptEdits',
    };
  }

  // Default: Sonnet (best cost-to-quality ratio)
  return {
    model: 'sonnet',
    permissionMode: 'acceptEdits',
  };
}

/**
 * Build instruction with extended thinking keyword if needed
 */
export function buildClaudeInstruction(
  baseInstruction: string,
  modelSelection: ModelSelection
): string {
  if (modelSelection.thinkingKeyword) {
    return `${modelSelection.thinkingKeyword.toUpperCase()} about this task:\n\n${baseInstruction}`;
  }
  return baseInstruction;
}

