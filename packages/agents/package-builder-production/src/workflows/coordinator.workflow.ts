import { proxyActivities, executeChild, condition } from '@temporalio/workflow'
import { AgentExecutorWorkflow } from './agent-executor.workflow.js'
import type { CoordinatorInput, CoordinatorAction } from '../types/coordinator.types.js'
import type * as coordinatorActivities from '../activities/coordinator.activities.js'

const { analyzeProblem, writeDiagnosticReport } = proxyActivities<typeof coordinatorActivities>({
  startToCloseTimeout: '2 minutes'
})

// Signal tracking
let receivedSignals: string[] = []

export function hasReceivedSignal(signalName: string): boolean {
  return receivedSignals.includes(signalName)
}

export function continueSignal(): void {
  receivedSignals.push('continue')
}

export function abortSignal(): void {
  receivedSignals.push('abort')
}

export const signals = {
  continue: continueSignal,
  abort: abortSignal
}

/**
 * CoordinatorWorkflow - AI-powered error recovery orchestration
 *
 * Analyzes problem, selects agent, delegates task, returns action to parent
 */
export async function CoordinatorWorkflow(
  input: CoordinatorInput
): Promise<CoordinatorAction> {
  const { problem, agentRegistry, maxAttempts, workspaceRoot } = input

  console.log(`[Coordinator] Analyzing ${problem.type} (attempt ${problem.context.attemptNumber}/${maxAttempts})`)

  // Step 1: Analyze problem with LLM
  const analysis = await analyzeProblem(problem, agentRegistry)

  console.log(`[Coordinator] Decision: ${analysis.decision}`)
  console.log(`[Coordinator] Reasoning: ${analysis.reasoning}`)

  // Step 2: Execute based on decision
  if (analysis.decision === 'DELEGATE' && analysis.agent && analysis.task) {
    console.log(`[Coordinator] Delegating to agent: ${analysis.agent}`)

    // Execute agent via child workflow
    const result = await executeChild(AgentExecutorWorkflow, {
      taskQueue: 'engine',
      workflowId: `agent-${analysis.agent}-${Date.now()}`,
      args: [{
        agent: analysis.agent,
        task: analysis.task,
        context: {
          packagePath: problem.context.packagePath,
          workspaceRoot
        }
      }]
    })

    // If agent succeeded, return RETRY action
    if (result.success) {
      console.log(`[Coordinator] Agent succeeded, returning RETRY`)
      return {
        decision: 'RETRY',
        modifications: result.changes,
        reasoning: `Agent ${analysis.agent} made changes: ${result.changes.join(', ')}`
      }
    }

    // Agent failed, escalate
    console.log(`[Coordinator] Agent failed, escalating`)
    return {
      decision: 'ESCALATE',
      escalation: {
        reason: `Agent ${analysis.agent} could not fix the issue`,
        waitForSignal: true,
        reportPath: '/tmp/coordinator-report.json'
      },
      reasoning: analysis.reasoning
    }
  }

  if (analysis.decision === 'ESCALATE' && analysis.escalation) {
    console.log(`[Coordinator] Escalating: ${analysis.escalation.reason}`)

    // Write diagnostic report
    await writeDiagnosticReport(problem, analysis)

    // Wait for human signal if requested
    if (analysis.escalation.waitForSignal) {
      console.log(`[Coordinator] Waiting for human signal...`)

      try {
        await condition(
          () => hasReceivedSignal('continue') || hasReceivedSignal('abort'),
          '24h'
        )

        if (hasReceivedSignal('abort')) {
          return {
            decision: 'FAIL',
            reasoning: 'Human chose to abort workflow'
          }
        }
      } catch (error) {
        // Timeout after 24h
        return {
          decision: 'FAIL',
          reasoning: 'Escalation timeout - no human response after 24h'
        }
      }
    }
  }

  return analysis
}
