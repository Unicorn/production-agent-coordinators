import { describe, it, expect } from 'vitest'
import type { AgentExecutionInput } from '../../types/coordinator.types.js'

describe('AgentExecutorWorkflow', () => {
  it('should have correct input type', () => {
    const input: AgentExecutionInput = {
      agent: 'environment-setup',
      task: {
        type: 'fix-shell',
        instructions: 'Fix shell path',
        context: {}
      },
      context: {
        packagePath: '/path/to/package',
        workspaceRoot: '/workspace'
      }
    }
    expect(input.agent).toBe('environment-setup')
  })
})
