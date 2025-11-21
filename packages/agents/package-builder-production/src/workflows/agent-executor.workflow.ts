import { proxyActivities } from '@temporalio/workflow'
import type { AgentExecutionInput, AgentExecutionResult } from '../types/coordinator.types.js'
import type * as agentExecutorActivities from '../activities/agent-executor.activities.js'

const { executeRealAgent } = proxyActivities<typeof agentExecutorActivities>({
  startToCloseTimeout: '30 minutes'
})

/**
 * AgentExecutorWorkflow - Executes a specific agent task
 *
 * Orchestrates the full AI agent execution pipeline:
 * 1. Build prompt with quality standards
 * 2. Execute with Claude API
 * 3. Parse JSON response
 * 4. Apply file changes
 */
export async function AgentExecutorWorkflow(
  input: AgentExecutionInput
): Promise<AgentExecutionResult> {
  const { agent, task, context } = input

  console.log(`[AgentExecutor] Starting real agent execution: ${agent}`)
  console.log(`[AgentExecutor] Task type: ${task.type}`)
  console.log(`[AgentExecutor] Package: ${context.packagePath}`)
  console.log(`[AgentExecutor] Plan: ${context.planPath || 'inferred'}`)

  const result = await executeRealAgent(input)

  console.log(`[AgentExecutor] Result: ${result.success ? 'SUCCESS' : 'FAILED'}`)
  console.log(`[AgentExecutor] Changes: ${result.changes.length}`)

  return result
}
