/**
 * Signal sent when user responds in Slack thread
 */
export interface UserResponseSignal {
  response: string;
  timestamp: string;
  userId: string;
}

/**
 * Signal sent when user approves the plan
 */
export interface PlanApprovalSignal {
  approved: boolean;
  feedback?: string;
  timestamp: string;
}

/**
 * Signal sent when user wants to stop/pause
 */
export interface StopWorkflowSignal {
  reason: 'stop' | 'pause';
  message?: string;
  timestamp: string;
}
