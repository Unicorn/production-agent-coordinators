import { proxyActivities } from '@temporalio/workflow'
import type { AgentExecutionInput, AgentExecutionResult } from '../types/coordinator.types.js'
import type * as agentExecutionActivities from '../activities/agent-execution.activities.js'

const { executeAgentTask } = proxyActivities<typeof agentExecutionActivities>({
  startToCloseTimeout: '30 minutes'
})

/**
 * AgentExecutorWorkflow - Executes a specific agent task
 *
 * For PoC: Returns simulated success
 * For Phase 2+: Actually executes agent prompt via LLM and applies changes
 */
export async function AgentExecutorWorkflow(
  input: AgentExecutionInput
): Promise<AgentExecutionResult> {
  const { agent, task, context } = input

  console.log(`[AgentExecutor] Starting agent: ${agent}`)
  console.log(`[AgentExecutor] Task type: ${task.type}`)

  const result = await executeAgentTask(
    agent,
    task.type,
    task.instructions,
    context.packagePath
  )

  console.log(`[AgentExecutor] Result: ${result.success ? 'SUCCESS' : 'FAILED'}`)

  return result
}
