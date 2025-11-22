import { createSlackConfig, SlackIntegrationConfig } from '@bernierllc/chat-integration-slack';

export interface SlackEnvValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate required Slack environment variables
 */
export function validateSlackEnv(): SlackEnvValidation {
  const errors: string[] = [];

  if (!process.env.SLACK_BOT_TOKEN) {
    errors.push('SLACK_BOT_TOKEN is required');
  }

  if (!process.env.SLACK_SIGNING_SECRET) {
    errors.push('SLACK_SIGNING_SECRET is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create Slack configuration for dev-workflow
 *
 * Uses @bernierllc/chat-integration-slack with dev-workflow specific settings
 */
export async function createDevWorkflowSlackConfig(): Promise<SlackIntegrationConfig> {
  // Validate environment first
  const validation = validateSlackEnv();
  if (!validation.valid) {
    throw new Error(`Slack environment validation failed: ${validation.errors.join(', ')}`);
  }

  // Create base config from chat-integration-slack
  const baseConfig = await createSlackConfig();

  // Override with dev-workflow specific settings
  return {
    ...baseConfig,
    slack: {
      ...baseConfig.slack,
      botToken: process.env.SLACK_BOT_TOKEN!,
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
      appToken: process.env.SLACK_APP_TOKEN
    },
    connection: {
      ...baseConfig.connection,
      socketMode: process.env.SLACK_SOCKET_MODE === 'true'
    },
    messaging: {
      ...baseConfig.messaging,
      bidirectional: true,
      bridgeThreads: true, // Critical for threaded conversations
      bridgeReactions: true,
      formatMessages: true
    },
    slashCommands: {
      ...baseConfig.slashCommands,
      enabled: true
    }
  };
}
