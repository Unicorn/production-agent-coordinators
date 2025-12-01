import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { loadAgentRegistry } from '../agent-registry.activities.js'

describe('Agent Registry Activities', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-registry-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should load built-in agents when directory does not exist', async () => {
    const registry = await loadAgentRegistry('/nonexistent/path')

    expect(registry.agents).toHaveLength(4) // 4 built-in agents
    expect(registry.agents.some(a => a.name === 'environment-setup')).toBe(true)
    expect(registry.agents.some(a => a.name === 'code-fix')).toBe(true)
    expect(registry.agents.some(a => a.name === 'dependency-resolution')).toBe(true)
    expect(registry.agents.some(a => a.name === 'diagnostic')).toBe(true)
  })

  it('should load agent from markdown file with frontmatter', async () => {
    const agentContent = `---
name: test-agent
capabilities:
  - testing
  - debugging
problemTypes:
  - BUILD_FAILURE
priority: 75
---

# Test Agent

This is a test agent for testing purposes.
`
    await fs.writeFile(path.join(tempDir, 'test-agent.md'), agentContent)

    const registry = await loadAgentRegistry(tempDir)

    const testAgent = registry.agents.find(a => a.name === 'test-agent')
    // STRONG assertion: Verify full agent structure instead of just toBeDefined
    expect(testAgent).toMatchObject({
      name: 'test-agent',
      capabilities: ['testing', 'debugging'],
      problemTypes: ['BUILD_FAILURE'],
      priority: 75
    })
    expect(testAgent?.problemTypes).toEqual(['BUILD_FAILURE'])
    expect(testAgent?.priority).toBe(75)
  })

  it('should skip files without frontmatter', async () => {
    await fs.writeFile(path.join(tempDir, 'no-frontmatter.md'), '# Just content')

    const registry = await loadAgentRegistry(tempDir)

    expect(registry.agents.every(a => a.name !== 'no-frontmatter')).toBe(true)
  })

  it('should include both custom and built-in agents', async () => {
    const agentContent = `---
name: custom-agent
capabilities: [custom]
problemTypes: [BUILD_FAILURE]
priority: 100
---
# Custom Agent
`
    await fs.writeFile(path.join(tempDir, 'custom-agent.md'), agentContent)

    const registry = await loadAgentRegistry(tempDir)

    expect(registry.agents.some(a => a.name === 'custom-agent')).toBe(true)
    expect(registry.agents.some(a => a.name === 'environment-setup')).toBe(true)
  })

  it('should skip invalid markdown files gracefully', async () => {
    // Create a file with incomplete frontmatter
    await fs.writeFile(path.join(tempDir, 'invalid.md'), '---\nbroken yaml: [')

    const registry = await loadAgentRegistry(tempDir)

    // Should still have built-in agents
    expect(registry.agents.length).toBeGreaterThanOrEqual(4)
  })
})
