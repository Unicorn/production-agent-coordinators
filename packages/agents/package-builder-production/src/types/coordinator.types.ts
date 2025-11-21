/**
 * Coordinator workflow types for AI-powered error recovery
 */

export type ProblemType = 'BUILD_FAILURE' | 'TEST_FAILURE' | 'QUALITY_FAILURE' | 'ENVIRONMENT_ERROR' | 'PACKAGE_SCAFFOLDING'

export interface Problem {
  type: ProblemType
  error: {
    message: string
    stack?: string
    code?: string
    stdout?: string
    stderr?: string
  }
  context: {
    packageName: string
    packagePath: string
    planPath: string
    phase: string
    attemptNumber: number
  }
}

export interface AgentRegistryEntry {
  name: string
  path: string
  capabilities: string[]
  problemTypes: ProblemType[]
  priority: number
}

export interface AgentRegistry {
  agents: AgentRegistryEntry[]
}

export type CoordinatorDecision = 'RETRY' | 'DELEGATE' | 'ESCALATE' | 'FAIL' | 'RESOLVED'

export interface CoordinatorAction {
  decision: CoordinatorDecision

  // For DELEGATE
  agent?: string
  task?: {
    type: string
    instructions: string
    context: Record<string, unknown>
  }

  // For ESCALATE
  escalation?: {
    reason: string
    waitForSignal: boolean
    reportPath: string
  }

  // For RETRY
  modifications?: string[]

  reasoning: string
}

export interface AgentExecutionInput {
  agent: string
  task: {
    type: string
    instructions: string
    context: Record<string, unknown>
  }
  context: {
    packagePath: string
    workspaceRoot: string
    planPath?: string
    githubContext?: {
      token: string
      repo: string
      branch: string
    }
  }
}

export interface AgentExecutionResult {
  success: boolean
  changes: string[]
  output: string
}

export interface CoordinatorInput {
  problem: Problem
  agentRegistry: AgentRegistry
  maxAttempts: number
  workspaceRoot: string
}
