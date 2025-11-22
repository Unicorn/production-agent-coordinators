import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  pollForTask,
  claimTask,
  updateTaskProgress,
  completeTask,
  sendProgressUpdate
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes'
});

export interface DevelopmentTaskWorkflowInput {
  workerId: string;
  slackChannel?: string;
  slackThreadTs?: string;
}

/**
 * DevelopmentTaskWorkflow (Phase 2)
 *
 * Polls BrainGrid for DEV tasks and claims them
 * Phase 2: Sends progress updates to Slack with stop/pause controls
 * Does NOT execute tasks yet - just logs what it would do
 */
export async function DevelopmentTaskWorkflow(
  input: DevelopmentTaskWorkflowInput
): Promise<void> {
  const { workerId, slackChannel, slackThreadTs } = input;

  console.log(`[DevWorker ${workerId}] Starting polling loop`);

  // Continuous polling loop
  while (true) {
    try {
      // Poll for available DEV tasks
      const task = await pollForTask({
        tags: ['DEV'],
        status: ['TODO', 'READY']
      });

      if (!task) {
        console.log(`[DevWorker ${workerId}] No tasks available, sleeping...`);
        await sleep('30s');
        continue;
      }

      console.log(`[DevWorker ${workerId}] Found task: ${task.id} - ${task.title}`);

      // Send progress update to Slack - Task Claimed
      if (slackChannel && slackThreadTs) {
        await sendProgressUpdate({
          channel: slackChannel,
          threadTs: slackThreadTs,
          phase: 'Task Claimed',
          status: 'started',
          message: `Working on: ${task.title}`,
          metadata: {
            taskId: task.id,
            worker: workerId
          }
        });
      }

      // Claim the task
      await claimTask(task.id, workerId);

      console.log(`[DevWorker ${workerId}] Claimed task: ${task.id}`);

      // Phase 2: Just log what we would do (real execution in Phase 3)
      await updateTaskProgress(task.id, 50, 'Phase 2: Would execute task here');

      console.log(`[DevWorker ${workerId}] Would execute: ${task.description}`);

      // Simulate work
      await sleep('5s');

      // Mark complete
      await completeTask(task.id, {
        note: 'Phase 2: Simulated completion'
      });

      console.log(`[DevWorker ${workerId}] Completed task: ${task.id}`);

      // Send completion update to Slack
      if (slackChannel && slackThreadTs) {
        await sendProgressUpdate({
          channel: slackChannel,
          threadTs: slackThreadTs,
          phase: 'Task Completed',
          status: 'completed',
          message: `Finished: ${task.title}`,
          metadata: {
            taskId: task.id
          }
        });
      }

    } catch (error) {
      console.error(`[DevWorker ${workerId}] Error:`, error);
      await sleep('1m'); // Back off on error
    }
  }
}
