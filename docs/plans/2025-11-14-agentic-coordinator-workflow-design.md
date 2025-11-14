# Agentic Coordinator Workflow Design

**Date:** 2025-11-14
**Status:** Design Complete - Ready for Implementation
**Author:** AI Assistant + Matt Bernier

## Executive Summary

This design introduces an AI-powered coordinator pattern for Temporal workflows that can dynamically handle failures by analyzing errors, selecting appropriate agents, and orchestrating recovery attempts. The coordinator acts as a meta-layer that understands workflow context, available agents, and can make intelligent decisions about how to proceed when things go wrong.

**Key Innovation:** Instead of hardcoded retry logic, workflows delegate failure recovery to a reusable `CoordinatorWorkflow` that uses LLM-based decision making and a registry of specialized agents.

## Phased Implementation Roadmap

### Phase 1: Proof of Concept (Current)
**Scope:** Build + Test phase error recovery in PackageBuildWorkflow
**Timeline:** 1-2 weeks
**Success Criteria:**
- CoordinatorWorkflow handles build failures (e.g., `spawn /bin/sh ENOENT`)
- CoordinatorWorkflow handles test failures
- Agent registry loads from ~/.claude/agents/
- LLM makes decisions via templated prompts
- Human escalation works via Temporal signals

**Deliverables:**
1. `coordinator.workflow.ts` - Core coordinator workflow
2. `agent-executor.workflow.ts` - Agent execution child workflow
3. `coordinator.activities.ts` - LLM decision making
4. `agent-registry.activities.ts` - Agent discovery and loading
5. Modified `package-build.workflow.ts` - Integration point
6. Prompt templates in `src/prompts/`
7. Built-in agents: environment-setup, code-fix, dependency-resolution, diagnostic

### Phase 2: Quality & Publish Expansion
**Scope:** Extend coordinator to quality checks and publishing phases
**Timeline:** 1 week after Phase 1
**New Capabilities:**
- Handle linting failures
- Handle type errors
- Handle publish failures (auth, registry issues)
- Agent chaining (diagnostic → fix → verify)

**Deliverables:**
1. Extended problem types
2. New specialized agents
3. Multi-step coordination strategies

### Phase 3: Generic Coordinator Pattern
**Scope:** Extract coordinator into reusable pattern for ANY workflow
**Timeline:** 2-3 weeks after Phase 2
**New Capabilities:**
- Activity registry (dynamic activity composition)
- Signal registry (coordinator can add new signals)
- Multi-tier coordination (coordinator can spawn supervisor coordinator)
- Workflow templates (coordinator can generate new workflow definitions)

**Deliverables:**
1. `@coordinator/generic-coordinator` package
2. Coordinator configuration DSL
3. Plugin system for agent/activity/signal registration
4. Documentation and examples

### Phase 4: Advanced Features
**Scope:** Production-grade features
**Timeline:** Ongoing after Phase 3
**Features:**
- A/B testing different coordination strategies
- Learning from past failures (vector DB of solutions)
- Cost optimization (cheaper models for simple decisions)
- Parallel agent execution
- Human-in-the-loop UI for signal management

---

## Phase 1 Technical Design (PoC)

### Architecture Overview

```
PackageBuildWorkflow (Parent)
    |
    ├─> runBuild() ──[fails]──> CoordinatorWorkflow (Child)
    |                                  |
    |                                  ├─> analyzeProblem(LLM)
    |                                  ├─> selectAgent(registry)
    |                                  └─> AgentExecutorWorkflow (Child)
    |                                         |
    |                                         ├─> loadAgentPrompt()
    |                                         ├─> executeAgentTask(LLM)
    |                                         └─> applyChanges()
    |
    └─> runBuild() ──[retry with fixes]──> success/fail
```

### Core Types

```typescript
// Problem definition
interface Problem {
  type: 'BUILD_FAILURE' | 'TEST_FAILURE' | 'QUALITY_FAILURE' | 'ENVIRONMENT_ERROR'
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

// Agent registry
interface AgentRegistryEntry {
  name: string
  path: string  // e.g. ~/.claude/agents/environment-setup.md
  capabilities: string[]  // ['environment', 'shell', 'permissions']
  problemTypes: ProblemType[]  // What problems it can solve
  priority: number  // Selection weight when multiple agents match
}

interface AgentRegistry {
  agents: AgentRegistryEntry[]
}

// Coordinator decision
interface CoordinatorAction {
  decision: 'RETRY' | 'DELEGATE' | 'ESCALATE' | 'FAIL'

  // For DELEGATE
  agent?: string  // Agent name from registry
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
  modifications?: string[]  // What changed before retry

  reasoning: string  // LLM's explanation
}

// Agent execution
interface AgentExecutionInput {
  agent: string
  task: {
    type: string
    instructions: string
    context: Record<string, unknown>
  }
  context: {
    packagePath: string
    workspaceRoot: string
  }
}

interface AgentExecutionResult {
  success: boolean
  changes: string[]  // Files modified
  output: string
}

// Coordinator workflow input
interface CoordinatorInput {
  problem: Problem
  agentRegistry: AgentRegistry
  maxAttempts: number
}
```

### File Structure

```
packages/agents/package-builder-production/
  src/
    workflows/
      coordinator.workflow.ts          # NEW: Main coordinator workflow
      agent-executor.workflow.ts       # NEW: Agent execution child workflow
      package-build.workflow.ts        # MODIFIED: Calls coordinator on errors
      package-builder.workflow.ts      # No changes

    activities/
      coordinator.activities.ts        # NEW: LLM decision making
      agent-registry.activities.ts     # NEW: Load ~/.claude/agents/
      agent-execution.activities.ts    # NEW: Execute agent tasks, apply changes
      build.activities.ts              # MODIFIED: Better error handling

    prompts/
      coordinator-analysis.hbs         # NEW: LLM prompt for error analysis
      agent-task.hbs                   # NEW: LLM prompt for agent execution

    types/
      coordinator.types.ts             # NEW: All coordinator types
      index.ts                         # MODIFIED: Export coordinator types
```

### Workflow Implementation Details

#### CoordinatorWorkflow

```typescript
export async function CoordinatorWorkflow(
  input: CoordinatorInput
): Promise<CoordinatorAction> {
  const { problem, agentRegistry, maxAttempts } = input

  // Step 1: Analyze problem with LLM
  const analysis = await proxyActivities<typeof coordinatorActivities>({
    startToCloseTimeout: '2 minutes'
  }).analyzeProblem(problem, agentRegistry)

  // Step 2: Execute based on decision
  if (analysis.decision === 'DELEGATE' && analysis.agent && analysis.task) {
    // Execute agent via child workflow
    const result = await executeChild(AgentExecutorWorkflow, {
      taskQueue: 'engine',
      workflowId: `agent-${analysis.agent}-${Date.now()}`,
      args: [{
        agent: analysis.agent,
        task: analysis.task,
        context: {
          packagePath: problem.context.packagePath,
          workspaceRoot: process.env.WORKSPACE_ROOT!
        }
      }]
    })

    // If agent succeeded, return RETRY action
    if (result.success) {
      return {
        decision: 'RETRY',
        modifications: result.changes,
        reasoning: `Agent ${analysis.agent} made changes: ${result.changes.join(', ')}`
      }
    }

    // Agent failed, escalate
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
    // Write diagnostic report
    await proxyActivities<typeof coordinatorActivities>({
      startToCloseTimeout: '1 minute'
    }).writeDiagnosticReport(problem, analysis)

    // Wait for human signal if requested
    if (analysis.escalation.waitForSignal) {
      // Wait for 'continue' or 'abort' signal, timeout after 24 hours
      const signal = await condition(
        () => hasReceivedSignal('continue') || hasReceivedSignal('abort'),
        '24h'
      )

      if (hasReceivedSignal('abort')) {
        return {
          decision: 'FAIL',
          reasoning: 'Human chose to abort workflow'
        }
      }
    }
  }

  return analysis
}
```

#### Integration in PackageBuildWorkflow

```typescript
// BEFORE (lines 50-59):
const buildResult = await runBuild({
  workspaceRoot: input.workspaceRoot,
  packagePath: input.packagePath
})
report.buildMetrics.buildTime = buildResult.duration

if (!buildResult.success) {
  throw new Error(`Build failed: ${buildResult.stderr}`)
}

// AFTER (lines 50-95):
let buildResult = await runBuild({
  workspaceRoot: input.workspaceRoot,
  packagePath: input.packagePath
})
report.buildMetrics.buildTime = buildResult.duration

// Coordinator loop for build failures
let coordinatorAttempts = 0
const maxCoordinatorAttempts = 3

while (!buildResult.success && coordinatorAttempts < maxCoordinatorAttempts) {
  // Load agent registry
  const agentRegistry = await loadAgentRegistry()

  // Create problem description
  const problem: Problem = {
    type: 'BUILD_FAILURE',
    error: {
      message: buildResult.stderr || 'Build failed',
      stderr: buildResult.stderr,
      stdout: buildResult.stdout
    },
    context: {
      packageName: input.packageName,
      packagePath: input.packagePath,
      planPath: input.planPath,
      phase: 'build',
      attemptNumber: coordinatorAttempts + 1
    }
  }

  // Spawn coordinator child workflow
  const action = await executeChild(CoordinatorWorkflow, {
    taskQueue: 'engine',
    workflowId: `coordinator-build-${input.packageName}-${Date.now()}`,
    args: [{
      problem,
      agentRegistry,
      maxAttempts: maxCoordinatorAttempts
    }]
  })

  // Handle coordinator decision
  if (action.decision === 'RETRY') {
    // Retry build with agent modifications
    buildResult = await runBuild({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath
    })
    coordinatorAttempts++
  } else if (action.decision === 'ESCALATE') {
    throw new Error(`Build escalated: ${action.escalation!.reason}`)
  } else {
    throw new Error(`Build failed after coordination: ${action.reasoning}`)
  }
}

if (!buildResult.success) {
  throw new Error(`Build failed after ${coordinatorAttempts} coordinator attempts`)
}

// Same pattern applies to test failures (lines 61-72)
```

### Activity Implementations

#### coordinatorActivities.analyzeProblem

```typescript
import Handlebars from 'handlebars'
import Anthropic from '@anthropic-ai/sdk'

export async function analyzeProblem(
  problem: Problem,
  registry: AgentRegistry
): Promise<CoordinatorAction> {
  // Load prompt template
  const templatePath = path.join(__dirname, '../prompts/coordinator-analysis.hbs')
  const templateContent = await fs.readFile(templatePath, 'utf-8')
  const template = Handlebars.compile(templateContent)

  // Render prompt with problem data
  const prompt = template({
    problem,
    agents: registry.agents
  })

  // Call Claude API
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    temperature: 0.2,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })

  // Parse JSON response
  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Expected text response from Claude')
  }

  const action = JSON.parse(content.text) as CoordinatorAction

  // Validate action structure
  validateCoordinatorAction(action)

  return action
}
```

#### agentRegistryActivities.loadAgentRegistry

```typescript
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import yaml from 'yaml'

export async function loadAgentRegistry(): Promise<AgentRegistry> {
  const agentDir = path.join(os.homedir(), '.claude/agents')

  // Check if directory exists
  try {
    await fs.access(agentDir)
  } catch {
    console.warn(`Agent directory not found: ${agentDir}`)
    return { agents: getBuiltInAgents() }
  }

  const files = await fs.readdir(agentDir)
  const agentFiles = files.filter(f => f.endsWith('.md'))

  const agents: AgentRegistryEntry[] = []

  for (const file of agentFiles) {
    const filePath = path.join(agentDir, file)
    const content = await fs.readFile(filePath, 'utf-8')

    // Parse frontmatter (YAML between --- markers)
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) {
      console.warn(`No frontmatter in ${file}, skipping`)
      continue
    }

    const frontmatter = yaml.parse(frontmatterMatch[1]) as Record<string, unknown>

    agents.push({
      name: frontmatter.name as string || file.replace('.md', ''),
      path: filePath,
      capabilities: frontmatter.capabilities as string[] || [],
      problemTypes: frontmatter.problemTypes as ProblemType[] || [],
      priority: frontmatter.priority as number || 50
    })
  }

  // Add built-in agents
  agents.push(...getBuiltInAgents())

  return { agents }
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
```

### Prompt Templates

#### coordinator-analysis.hbs

```handlebars
You are a workflow coordinator analyzing build/test failures.

PROBLEM DETAILS:
- Type: {{problem.type}}
- Phase: {{problem.context.phase}}
- Package: {{problem.context.packageName}}
- Attempt: {{problem.context.attemptNumber}}

ERROR:
{{problem.error.message}}
{{#if problem.error.stderr}}

STDERR OUTPUT:
{{problem.error.stderr}}
{{/if}}

{{#if problem.error.stdout}}

STDOUT OUTPUT:
{{problem.error.stdout}}
{{/if}}

AVAILABLE AGENTS:
{{#each agents}}
- {{name}}: {{capabilities}} (priority: {{priority}}, handles: {{problemTypes}})
{{/each}}

INSTRUCTIONS:
Analyze this error and decide the best course of action. Return a JSON object matching this exact structure:

{
  "decision": "RETRY" | "DELEGATE" | "ESCALATE" | "FAIL",
  "agent": "agent-name",  // Only if decision is DELEGATE
  "task": {               // Only if decision is DELEGATE
    "type": "fix-build-error",
    "instructions": "Detailed instructions for the agent",
    "context": {}
  },
  "escalation": {         // Only if decision is ESCALATE
    "reason": "Why human intervention is needed",
    "waitForSignal": true,
    "reportPath": "/path/to/report.json"
  },
  "modifications": [],    // Only if decision is RETRY
  "reasoning": "Explain your decision and why this approach will work"
}

DECISION GUIDELINES:
1. DELEGATE: If an agent can fix this (environment setup, code fix, dependency resolution)
2. ESCALATE: If this requires human judgment or is beyond agent capabilities
3. RETRY: If the error is transient or already fixed by a previous agent
4. FAIL: If we've exhausted attempts or this is fundamentally unfixable

Consider:
- Is this an environment issue (missing tools, wrong paths, permissions)?
- Is this a code issue (syntax errors, type errors, imports)?
- Is this a dependency issue (missing packages, version conflicts)?
- Is this transient (network, timing)?
- How many attempts have we made already?

Respond with ONLY the JSON object, no additional text.
```

### Agent Frontmatter Format

Example ~/.claude/agents/custom-fixer.md:

```markdown
---
name: custom-fixer
capabilities:
  - custom-logic
  - special-handling
problemTypes:
  - BUILD_FAILURE
priority: 75
---

# Custom Fixer Agent

This agent handles custom build issues specific to our codebase.

## Instructions

When you receive a task, analyze the error and:
1. Check for X
2. Fix Y
3. Verify Z

## Examples

...
```

---

## Testing Strategy

### Phase 1 Testing

1. **Unit Tests**
   - coordinatorActivities.analyzeProblem with mock LLM
   - agentRegistryActivities.loadAgentRegistry with fixture files
   - Validate type checking and error handling

2. **Integration Tests**
   - End-to-end: Trigger build failure → coordinator spawns → agent fixes → retry succeeds
   - Test each decision type (RETRY, DELEGATE, ESCALATE, FAIL)
   - Test signal handling for human escalation

3. **Manual Testing**
   - Run against real failing package build
   - Verify agent registry loads from ~/.claude/agents/
   - Verify Temporal UI shows coordinator workflow hierarchy
   - Test prompt template modifications without code changes

---

## Monitoring & Observability

### Metrics to Track

- Coordinator invocation count by problem type
- Decision distribution (DELEGATE vs ESCALATE vs FAIL)
- Agent success rate by agent type
- Time to resolution
- Human escalation frequency
- LLM token usage and cost

### Logging

All coordinator activities log:
- Problem details
- LLM prompt and response
- Agent selection reasoning
- Action taken
- Outcome

Logs include correlation IDs linking parent workflow → coordinator → agent executor.

---

## Future Expansion Considerations

### Phase 2 Notes
- Quality phase failures need different agent types (linting-fix, type-fix)
- Publish phase needs registry-auth agent
- Consider agent chaining: diagnostic → fix → verify

### Phase 3 Notes
- Activity registry will need similar structure to agent registry
- Coordinator could generate new activity definitions on-the-fly
- Signal registry allows coordinator to define custom human intervention points
- Multi-tier: SupervisorCoordinator reviews CoordinatorWorkflow decisions

### Phase 4 Notes
- Vector DB of past failures → similarity search for solutions
- A/B test coordination strategies
- Cost optimization: use cheaper models for simple decisions, Claude for complex
- Parallel agent execution: spawn multiple agents to try different fixes simultaneously

---

## Success Metrics

### Phase 1 Success Criteria

- [ ] CoordinatorWorkflow handles `spawn /bin/sh ENOENT` error
- [ ] CoordinatorWorkflow selects correct agent from registry
- [ ] Agent execution modifies files and triggers successful retry
- [ ] Human escalation works (workflow waits for signal)
- [ ] Prompt templates can be modified without code changes
- [ ] All TypeScript strict mode enabled, no type errors
- [ ] 80%+ test coverage on new code

### Phase 2+ Success Criteria (Future)

- [ ] Coordinator handles all workflow phases
- [ ] Agent chaining works (diagnostic → fix → verify)
- [ ] Activity registry supports dynamic composition
- [ ] Learning system reduces escalation rate over time

---

## Implementation Notes

### Dependencies to Add

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "handlebars": "^4.7.8",
    "yaml": "^2.3.4"
  },
  "devDependencies": {
    "@types/handlebars": "^4.1.0"
  }
}
```

### Environment Variables Required

```bash
ANTHROPIC_API_KEY=sk-ant-...
WORKSPACE_ROOT=/Users/mattbernier/projects/tools
AGENT_REGISTRY_PATH=~/.claude/agents  # Optional, defaults to this
```

### TypeScript Configuration

Ensure strict mode in tsconfig.json:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noUncheckedIndexedAccess": true
  }
}
```

---

## Appendix: Full Type Definitions

See `src/types/coordinator.types.ts` for complete type definitions with JSDoc documentation.
