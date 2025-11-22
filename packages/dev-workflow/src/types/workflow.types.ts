/**
 * Input for DevWorkflowCoordinator workflow
 */
export interface DevWorkflowCoordinatorInput {
  /** Feature request from Slack command */
  featureRequest: string;

  /** Slack channel for progress updates */
  slackChannel: string;

  /** Slack thread timestamp */
  slackThreadTs: string;

  /** Repository root path */
  repoPath: string;

  /** Base branch for PR (default: main) */
  baseBranch?: string;

  /** Workspace root (default: repoPath) */
  workspaceRoot?: string;
}

/**
 * Output from DevWorkflowCoordinator workflow
 */
export interface DevWorkflowCoordinatorResult {
  /** Whether workflow completed successfully */
  success: boolean;

  /** Pull request URL if created */
  prUrl?: string;

  /** Pull request number if created */
  prNumber?: number;

  /** Number of tasks completed successfully */
  tasksCompleted: number;

  /** Number of tasks that failed */
  tasksFailed: number;

  /** Error message if workflow failed */
  error?: string;

  /** Feature branch name */
  featureBranch?: string;
}
