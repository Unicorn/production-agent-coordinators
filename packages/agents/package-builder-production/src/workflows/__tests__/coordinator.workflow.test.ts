import { describe, it, expect } from 'vitest'
import type { CoordinatorInput } from '../../types/coordinator.types.js'

describe('CoordinatorWorkflow', () => {
  it('should have correct input type', () => {
    const input: CoordinatorInput = {
      problem: {
        type: 'BUILD_FAILURE',
        error: { message: 'test' },
        context: {
          packageName: 'test',
          packagePath: '/path',
          planPath: '/plan',
          phase: 'build',
          attemptNumber: 1
        }
      },
      agentRegistry: { agents: [] },
      maxAttempts: 3
    }
    expect(input.maxAttempts).toBe(3)
  })
})
