import { proxyActivities, defineSignal, defineQuery, setHandler, condition } from '@temporalio/workflow';
import type * as activities from '../activities';
import { DependencyTree, TaskStatus } from '../types/dependency-tree.types';
import { TaskInput } from '../types/task.types';
import { UserResponseSignal, PlanApprovalSignal, StopWorkflowSignal } from '../types/signals.types';

// Define signals
export const userResponseSignal = defineSignal<[UserResponseSignal]>('userResponse');
export const planApprovalSignal = defineSignal<[PlanApprovalSignal]>('planApproval');
export const stopWorkflowSignal = defineSignal<[StopWorkflowSignal]>('stopWorkflow');

// Define query
export const getConversationStateQuery = defineQuery<ConversationState>('getConversationState');

interface ConversationState {
  questions: string[];
  responses: UserResponseSignal[];
  currentQuestion?: string;
  awaitingApproval: boolean;
}

// Conversation state
let conversationState: ConversationState = {
  questions: [],
  responses: [],
  awaitingApproval: false
};

let pendingResponse: UserResponseSignal | undefined;
let pendingApproval: PlanApprovalSignal | undefined;
let stopRequested: StopWorkflowSignal | undefined;

// Create activity proxies for ALL activities (Temporal best practice)
const {
  createBrainGridREQ,
  createBrainGridTasks,
  buildDependencyTree,
  // Add Slack activities
  sendThreadMessage,
  askQuestion
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes'
});

export interface PlanningWorkflowInput {
  featureRequest: string;
  repoPath: string;
  projectId?: string;
  // New: Slack integration
  slackChannel?: string;
  slackThreadTs?: string;
}

export interface PlanningWorkflowResult {
  success: boolean;
  reqId?: string;
  taskCount?: number;
  error?: string;
  feedback?: string;
}

/**
 * Helper function to safely send Slack messages without failing workflow
 * Logs warnings on failure but allows workflow to continue
 */
async function safeSlackMessage(
  params: SendThreadMessageParams
): Promise<void> {
  try {
    await sendThreadMessage(params);
  } catch (error) {
    console.warn('[Planning] Non-critical Slack message failed:', error);
  }
}

/**
 * FeaturePlanningWorkflow (Phase 2)
 *
 * Creates BrainGrid REQ and task breakdown with conversational gathering via Slack
 */
export async function FeaturePlanningWorkflow(
  input: PlanningWorkflowInput
): Promise<PlanningWorkflowResult> {
  const { featureRequest, projectId, slackChannel, slackThreadTs } = input;

  // Reset state at workflow start to prevent state pollution
  conversationState = {
    questions: [],
    responses: [],
    awaitingApproval: false
  };
  pendingResponse = undefined;
  pendingApproval = undefined;
  stopRequested = undefined;

  // Set up signal handlers
  setHandler(userResponseSignal, (signal: UserResponseSignal) => {
    pendingResponse = signal;
    conversationState.responses.push(signal);
  });

  setHandler(planApprovalSignal, (signal: PlanApprovalSignal) => {
    pendingApproval = signal;
  });

  setHandler(stopWorkflowSignal, (signal: StopWorkflowSignal) => {
    stopRequested = signal;
  });

  setHandler(getConversationStateQuery, () => conversationState);

  console.log(`[Planning] Starting conversational planning for: ${featureRequest}`);

  // Phase 2: If Slack enabled, gather requirements conversationally
  let refinedRequirement = featureRequest;

  if (slackChannel && slackThreadTs) {
    console.log(`[Planning] Starting Slack conversation in ${slackChannel}`);

    // Welcome message
    await safeSlackMessage({
      channel: slackChannel,
      threadTs: slackThreadTs,
      text: `Great! I'll help you plan this feature. Let me ask a few questions to understand your requirements better.`
    });

    // Ask clarifying questions
    const questions = [
      'What is the main goal of this feature?',
      'Who are the primary users?',
      'Are there any specific technical constraints or dependencies?'
    ];

    for (const question of questions) {
      if (stopRequested) break;

      conversationState.currentQuestion = question;
      conversationState.questions.push(question);

      await askQuestion({
        channel: slackChannel,
        threadTs: slackThreadTs,
        question
      });

      // Wait for user response (via signal)
      pendingResponse = undefined;
      await condition(() => pendingResponse !== undefined || stopRequested !== undefined, '5m');

      if (stopRequested) {
        console.log('[Planning] Stop requested, saving state and exiting');
        break;
      }

      console.log(`[Planning] Received response: ${pendingResponse?.response}`);
    }

    // Build refined requirement from conversation
    refinedRequirement = conversationState.responses
      .map(r => r.response)
      .join(' | ');

    // Present summary for approval
    conversationState.awaitingApproval = true;

    await safeSlackMessage({
      channel: slackChannel,
      threadTs: slackThreadTs,
      text: `Based on our conversation, here's what I understand:\n\n${refinedRequirement}\n\nDoes this look correct? Reply 'approve' to continue or provide feedback to adjust.`
    });

    // Wait for approval
    pendingApproval = undefined;
    await condition(() => pendingApproval !== undefined, '10m');

    if (!pendingApproval?.approved) {
      console.log('[Planning] Plan not approved, feedback:', pendingApproval?.feedback);

      // Send rejection message to Slack
      await safeSlackMessage({
        channel: slackChannel,
        threadTs: slackThreadTs,
        text: `Plan was not approved. Feedback: ${pendingApproval?.feedback || 'No feedback provided'}\n\nPlease restart the workflow with updated requirements.`
      });

      // Return early with error result
      return {
        success: false,
        error: 'Plan rejected by user',
        feedback: pendingApproval?.feedback
      };
    }

    await safeSlackMessage({
      channel: slackChannel,
      threadTs: slackThreadTs,
      text: `Perfect! I'll get started on creating the tasks. I'll update you as I make progress.`
    });
  }

  // Create BrainGrid REQ with refined requirement
  const reqId = await createBrainGridREQ({
    description: refinedRequirement,
    projectId
  });

  console.log(`[Planning] Created REQ: ${reqId}`);

  // Progress update
  if (slackChannel && slackThreadTs) {
    await safeSlackMessage({
      channel: slackChannel,
      threadTs: slackThreadTs,
      text: `✅ Created requirement ${reqId}`
    });
  }

  // Mock task breakdown (Phase 1 logic - will be AI-powered later)
  const mockTasks: TaskInput[] = [
    {
      id: 'task-1',
      reqId,
      name: 'Setup and configuration',
      description: 'Initial setup for ' + refinedRequirement,
      tags: ['DEV', 'backend'],
      dependencies: []
    },
    {
      id: 'task-2',
      reqId,
      name: 'Implementation',
      description: 'Core implementation',
      tags: ['DEV', 'frontend'],
      dependencies: ['task-1']
    },
    {
      id: 'task-3',
      reqId,
      name: 'Tests',
      description: 'Write tests',
      tags: ['TEST'],
      dependencies: ['task-2']
    }
  ];

  console.log(`[Planning] Created ${mockTasks.length} tasks`);

  // Build dependency tree
  const dependencyTree = await buildDependencyTree(reqId, mockTasks);

  console.log(`[Planning] Built dependency tree with ${dependencyTree.layers.length} layers`);

  // Create tasks in BrainGrid
  await createBrainGridTasks(reqId, mockTasks);

  console.log(`[Planning] Published tasks to BrainGrid`);

  // Final progress update
  if (slackChannel && slackThreadTs) {
    await safeSlackMessage({
      channel: slackChannel,
      threadTs: slackThreadTs,
      text: `✅ Planning complete! Created ${mockTasks.length} tasks organized in ${dependencyTree.layers.length} dependency layers.\n\nDevelopment workers will now pick up these tasks.`
    });
  }

  return {
    success: true,
    reqId,
    taskCount: mockTasks.length
  };
}
