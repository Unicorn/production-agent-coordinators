import { getTemporalClient } from '../temporal/connection';
import { FeaturePlanningWorkflow } from '../workflows/feature-planning.workflow';

export interface SlackCommandPayload {
  command: string;
  text: string;
  channel_id: string;
  user_id: string;
  response_url: string;
  trigger_id?: string;
}

export interface CommandHandlerResult {
  success: boolean;
  workflowId?: string;
  error?: string;
}

/**
 * Handle /dev-workflow slash command
 *
 * Uses singleton Temporal connection to prevent resource leaks.
 */
export async function handleDevWorkflowCommand(
  payload: SlackCommandPayload
): Promise<CommandHandlerResult> {
  // Validate input
  if (!payload.text || payload.text.trim().length === 0) {
    return {
      success: false,
      error: 'Please provide a feature description. Example: /dev-workflow Add OAuth2 authentication'
    };
  }

  // Validate required environment variables
  const taskQueue = process.env.DEV_WORKFLOW_TASK_QUEUE || 'dev-workflow';
  const repoPath = process.env.REPO_PATH;

  if (!repoPath) {
    return {
      success: false,
      error: 'Server configuration error: REPO_PATH environment variable is not set'
    };
  }

  try {
    // Get singleton Temporal client (prevents resource leaks)
    const client = await getTemporalClient();

    // Start planning workflow with Slack context
    const workflowId = `dev-workflow-${payload.channel_id}-${Date.now()}`;

    await client.workflow.start(FeaturePlanningWorkflow, {
      taskQueue,
      workflowId,
      args: [{
        featureRequest: payload.text,
        repoPath,
        slackChannel: payload.channel_id,
        slackThreadTs: undefined // Will be set by first message response
      }]
    });

    return {
      success: true,
      workflowId
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Failed to start dev workflow for channel ${payload.channel_id}:`, error);

    return {
      success: false,
      error: `Failed to start workflow: ${errorMessage}. Please check server configuration and try again.`
    };
  }
}
