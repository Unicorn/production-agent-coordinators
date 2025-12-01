import * as fs from 'fs/promises'
import * as path from 'path'
import yaml from 'yaml'
import type { AgentRegistry, AgentRegistryEntry, ProblemType } from '../types/coordinator.types.js'

export async function loadAgentRegistry(agentDir?: string): Promise<AgentRegistry> {
  const dir = agentDir || path.join(process.env.HOME || '~', '.claude/agents')

  const customAgents: AgentRegistryEntry[] = []

  try {
    await fs.access(dir)
    const files = await fs.readdir(dir)
    const agentFiles = files.filter(f => f.endsWith('.md'))

    for (const file of agentFiles) {
      const filePath = path.join(dir, file)
      const content = await fs.readFile(filePath, 'utf-8')

      // Parse frontmatter (YAML between --- markers)
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (!frontmatterMatch) {
        console.warn(`No frontmatter in ${file}, skipping`)
        continue
      }

      try {
        const frontmatter = yaml.parse(frontmatterMatch[1]) as Record<string, unknown>

        customAgents.push({
          name: (frontmatter.name as string) || file.replace('.md', ''),
          path: filePath,
          capabilities: (frontmatter.capabilities as string[]) || [],
          problemTypes: (frontmatter.problemTypes as ProblemType[]) || [],
          priority: (frontmatter.priority as number) || 50
        })
      } catch (parseError) {
        console.warn(`Failed to parse frontmatter in ${file}, skipping:`, parseError)
        continue
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read - use only built-in agents
  }

  const builtInAgents = getBuiltInAgents()
  return { agents: [...customAgents, ...builtInAgents] }
}

function getBuiltInAgents(): AgentRegistryEntry[] {
  return [
    {
      name: 'environment-setup',
      path: 'builtin',
      capabilities: ['shell', 'environment', 'permissions', 'PATH'],
      problemTypes: ['ENVIRONMENT_ERROR'],
      priority: 100
    },
    {
      name: 'code-fix',
      path: 'builtin',
      capabilities: ['typescript', 'javascript', 'syntax', 'imports'],
      problemTypes: ['BUILD_FAILURE'],
      priority: 80
    },
    {
      name: 'dependency-resolution',
      path: 'builtin',
      capabilities: ['npm', 'yarn', 'package.json', 'versions'],
      problemTypes: ['BUILD_FAILURE', 'TEST_FAILURE'],
      priority: 90
    },
    {
      name: 'diagnostic',
      path: 'builtin',
      capabilities: ['analysis', 'debugging', 'logging'],
      problemTypes: ['BUILD_FAILURE', 'TEST_FAILURE', 'QUALITY_FAILURE'],
      priority: 50
    }
  ]
}
