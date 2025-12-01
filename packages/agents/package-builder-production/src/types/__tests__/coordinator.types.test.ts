import { describe, it, expect } from 'vitest'
import type {
  Problem,
  CoordinatorAction
} from '../coordinator.types.js'

describe('Coordinator Types', () => {
  it('should create valid Problem', () => {
    const problem: Problem = {
      type: 'BUILD_FAILURE',
      error: {
        message: 'Build failed',
        stderr: 'Error output'
      },
      context: {
        packageName: 'test-package',
        packagePath: '/path/to/package',
        planPath: '/path/to/plan.md',
        phase: 'build',
        attemptNumber: 1
      }
    }
    expect(problem.type).toBe('BUILD_FAILURE')
  })

  it('should create valid CoordinatorAction for DELEGATE', () => {
    const action: CoordinatorAction = {
      decision: 'DELEGATE',
      agent: 'environment-setup',
      task: {
        type: 'fix-shell',
        instructions: 'Fix shell path',
        context: {}
      },
      reasoning: 'Environment issue detected'
    }
    expect(action.decision).toBe('DELEGATE')
    expect(action.agent).toBeDefined()
  })

  it('should create valid CoordinatorAction for ESCALATE', () => {
    const action: CoordinatorAction = {
      decision: 'ESCALATE',
      escalation: {
        reason: 'Cannot fix automatically',
        waitForSignal: true,
        reportPath: '/tmp/report.json'
      },
      reasoning: 'Requires human intervention'
    }
    expect(action.decision).toBe('ESCALATE')
    expect(action.escalation).toBeDefined()
  })
})
