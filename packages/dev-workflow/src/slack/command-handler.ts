import { Connection, Client } from '@temporalio/client';
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

  try {
    // Connect to Temporal
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
    });

    const client = new Client({ connection });

    // Start planning workflow with Slack context
    const workflowId = `dev-workflow-${payload.channel_id}-${Date.now()}`;

    await client.workflow.start(FeaturePlanningWorkflow, {
      taskQueue: 'dev-workflow',
      workflowId,
      args: [{
        featureRequest: payload.text,
        repoPath: process.env.REPO_PATH || '/default/repo',
        slackChannel: payload.channel_id,
        slackThreadTs: undefined // Will be set by first message response
      }]
    });

    return {
      success: true,
      workflowId
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
