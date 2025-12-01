import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeProblem } from '../coordinator.activities.js'
import type { Problem, AgentRegistry } from '../../types/coordinator.types.js'

// Create mock function that will be shared across all instances
const mockCreate = vi.fn()

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate
      }
    }))
  }
})

describe('Coordinator Activities', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    // Set ANTHROPIC_API_KEY for tests
    process.env.ANTHROPIC_API_KEY = 'test-key-for-unit-tests'
  })

  it('should analyze problem and return DELEGATE action', async () => {
    const problem: Problem = {
      type: 'BUILD_FAILURE',
      error: {
        message: 'spawn /bin/sh ENOENT',
        stderr: 'Error: spawn /bin/sh ENOENT'
      },
      context: {
        packageName: 'test-package',
        packagePath: '/path/to/package',
        planPath: '/path/to/plan.md',
        phase: 'build',
        attemptNumber: 1
      }
    }

    const registry: AgentRegistry = {
      agents: [{
        name: 'environment-setup',
        path: 'builtin',
        capabilities: ['shell', 'environment'],
        problemTypes: ['ENVIRONMENT_ERROR'],
        priority: 100
      }]
    }

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          decision: 'DELEGATE',
          agent: 'environment-setup',
          task: {
            type: 'fix-shell-path',
            instructions: 'Fix shell path issue',
            context: {}
          },
          reasoning: 'This is an environment issue with shell path'
        })
      }]
    })

    const action = await analyzeProblem(problem, registry)

    expect(action.decision).toBe('DELEGATE')
    expect(action.agent).toBe('environment-setup')
    // STRONG assertion: Verify task has required structure
    expect(action.task).toEqual({
      type: 'fix-shell-path',
      instructions: 'Fix shell path issue',
      context: {}
    })
    expect(mockCreate).toHaveBeenCalled()
  })

  it('should handle ESCALATE decision', async () => {
    const problem: Problem = {
      type: 'BUILD_FAILURE',
      error: {
        message: 'Unknown error',
        stderr: 'Something went wrong'
      },
      context: {
        packageName: 'test-package',
        packagePath: '/path',
        planPath: '/plan.md',
        phase: 'build',
        attemptNumber: 3
      }
    }

    const registry: AgentRegistry = { agents: [] }

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          decision: 'ESCALATE',
          escalation: {
            reason: 'Too many attempts, need human review',
            waitForSignal: true,
            reportPath: '/tmp/report.json'
          },
          reasoning: 'Exceeded max attempts'
        })
      }]
    })

    const action = await analyzeProblem(problem, registry)

    expect(action.decision).toBe('ESCALATE')
    // STRONG assertion: Verify escalation has required structure
    expect(action.escalation).toEqual({
      reason: 'Too many attempts, need human review',
      waitForSignal: true,
      reportPath: '/tmp/report.json'
    })
  })
})
