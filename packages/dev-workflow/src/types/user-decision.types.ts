/**
 * User decision in response to task failures
 */
export interface UserDecisionSignal {
  decision: 'retry' | 'skip' | 'abort';
  taskId: string;
  timestamp: string;
  reason?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate user decision signal
 */
export function validateUserDecision(signal: UserDecisionSignal): ValidationResult {
  const errors: string[] = [];

  if (!signal.decision || !['retry', 'skip', 'abort'].includes(signal.decision)) {
    errors.push('Invalid decision type');
  }

  if (!signal.taskId) {
    errors.push('taskId is required');
  }

  if (!signal.timestamp) {
    errors.push('timestamp is required');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
