import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  pollForTask,
  claimTask,
  updateTaskProgress,
  completeTask
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes'
});

export interface DevelopmentTaskWorkflowInput {
  workerId: string;
}

/**
 * Minimal DevelopmentTaskWorkflow (Phase 1)
 *
 * Polls BrainGrid for DEV tasks and claims them
 * Does NOT execute tasks yet - just logs what it would do
 */
export async function DevelopmentTaskWorkflow(
  input: DevelopmentTaskWorkflowInput
): Promise<void> {
  const { workerId } = input;

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

      // Claim the task
      await claimTask(task.id, workerId);

      console.log(`[DevWorker ${workerId}] Claimed task: ${task.id}`);

      // Phase 1: Just log what we would do
      await updateTaskProgress(task.id, 50, 'Phase 1: Would execute task here');

      console.log(`[DevWorker ${workerId}] Would execute: ${task.description}`);

      // Simulate work
      await sleep('5s');

      // Mark complete
      await completeTask(task.id, {
        note: 'Phase 1: Simulated completion'
      });

      console.log(`[DevWorker ${workerId}] Completed task: ${task.id}`);

    } catch (error) {
      console.error(`[DevWorker ${workerId}] Error:`, error);
      await sleep('1m'); // Back off on error
    }
  }
}
