import { WebClient } from '@slack/web-api';
import type { Block, KnownBlock } from '@slack/web-api';
import { createDevWorkflowSlackConfig } from '../slack/slack-config';

let webClient: WebClient | null = null;

/**
 * Get or create Slack Web API client
 */
async function getSlackClient(): Promise<WebClient> {
  if (!webClient) {
    const config = await createDevWorkflowSlackConfig();
    webClient = new WebClient(config.slack.botToken);
  }
  return webClient;
}

export interface SendThreadMessageParams {
  channel: string;
  threadTs: string;
  text: string;
  blocks?: (Block | KnownBlock)[];
}

export interface SendThreadMessageResult {
  success: boolean;
  ts?: string;
  error?: string;
}

/**
 * Send a message to a Slack thread
 */
export async function sendThreadMessage(
  params: SendThreadMessageParams
): Promise<SendThreadMessageResult> {
  try {
    const client = await getSlackClient();

    const result = await client.chat.postMessage({
      channel: params.channel,
      thread_ts: params.threadTs,
      text: params.text,
      blocks: params.blocks
    });

    return {
      success: true,
      ts: result.ts as string
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export interface AskQuestionParams {
  channel: string;
  threadTs: string;
  question: string;
}

export interface AskQuestionResult {
  messageTs: string;
  channel: string;
}

/**
 * Ask a question in a Slack thread
 */
export async function askQuestion(
  params: AskQuestionParams
): Promise<AskQuestionResult> {
  const result = await sendThreadMessage({
    channel: params.channel,
    threadTs: params.threadTs,
    text: params.question
  });

  if (!result.success || !result.ts) {
    throw new Error(`Failed to send question: ${result.error}`);
  }

  return {
    messageTs: result.ts,
    channel: params.channel
  };
}

export interface WaitForResponseParams {
  channel: string;
  threadTs: string;
  questionTs: string;
  timeoutMs?: number;
}

export interface WaitForResponseResult {
  response?: string;
  timedOut: boolean;
}

/**
 * Wait for user response to a question
 *
 * NOTE: Phase 2 uses polling. Phase 3 will use Temporal signals.
 */
export async function waitForResponse(
  params: WaitForResponseParams
): Promise<WaitForResponseResult> {
  const timeout = params.timeoutMs || 300000; // 5 min default
  const startTime = Date.now();

  // Phase 2: Simple timeout simulation
  // Phase 3: Replace with Temporal signal waiting
  while (Date.now() - startTime < timeout) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // TODO Phase 3: Check for Temporal signal with user response
    // For now, just timeout
  }

  return {
    timedOut: true
  };
}

export interface SendProgressUpdateParams {
  channel: string;
  threadTs: string;
  phase: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  message: string;
  metadata?: Record<string, any>;
  workflowId?: string;
}

/**
 * Send progress update to Slack thread with interactive controls
 *
 * Phase 2: Includes stop/pause buttons for in-progress tasks
 */
export async function sendProgressUpdate(
  params: SendProgressUpdateParams
): Promise<SendThreadMessageResult> {
  const emoji = {
    started: '🏁',
    in_progress: '⚙️',
    completed: '✅',
    failed: '❌'
  }[params.status];

  const blocks: (Block | KnownBlock)[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${params.phase}*\n${params.message}`
      }
    }
  ];

  // Add metadata context if provided
  if (params.metadata && Object.keys(params.metadata).length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: Object.entries(params.metadata)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' • ')
        }
      ]
    });
  }

  // Add stop/pause buttons if workflow is in progress
  if (params.status === 'in_progress' || params.status === 'started') {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '⏸️ Pause' },
          action_id: 'pause_workflow',
          style: 'primary'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '⏹️ Stop' },
          action_id: 'stop_workflow',
          style: 'danger',
          confirm: {
            title: { type: 'plain_text', text: 'Stop Workflow?' },
            text: { type: 'plain_text', text: 'This will stop the workflow. Are you sure?' },
            confirm: { type: 'plain_text', text: 'Yes, stop it' },
            deny: { type: 'plain_text', text: 'Cancel' }
          }
        }
      ]
    });
  }

  // Send the message with blocks
  const result = await sendThreadMessage({
    channel: params.channel,
    threadTs: params.threadTs,
    text: `${emoji} ${params.phase}: ${params.message}`,
    blocks
  });

  return result;
}
