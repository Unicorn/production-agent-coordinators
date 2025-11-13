# Agent Invocation Architecture

## Overview

This document describes how Temporal activities invoke Claude Code agents for plan generation. The architecture allows workflows to delegate complex tasks (like plan writing) to specialized AI agents while maintaining workflow reliability and observability.

## Current Status

**Implementation Status:** Partially implemented (placeholder)

The signal coordination architecture (Tasks 1-6) is complete:
- ✅ Plans Workflow singleton processes requests
- ✅ Build workflows signal Plans Workflow when package not found
- ✅ Polling with exponential backoff waits for plan generation
- ✅ MCP integration for plan registration

**Pending:** Agent invocation for actual plan content generation (Task 7)

## Architecture Diagram

```
Build Workflow (Package Not Found)
        ↓
  Signal Plans Workflow
        ↓
Plans Workflow (Queue Request)
        ↓
generatePlanForPackage Activity
        ↓
    [INVOKE AGENT] ← Task 7: This step needs implementation
        ↓
package-planning-writer Agent
        ↓
  Generate Plan Markdown
        ↓
Register Plan with MCP
        ↓
Build Workflow Polling Succeeds
```

## Agent Invocation Pattern

### Step 1: Prepare Agent Context

```typescript
const agentInput = {
  packageName: input.packageName,
  dependencies: depsData.dependencies || [],
  purpose: depsData.purpose || 'Inferred from dependency graph',
  outputPath: planPath,
  metadata: {
    requestedBy: input.requestedBy,
    timestamp: Date.now(),
  }
};
```

### Step 2: Invoke Agent via Subprocess

```typescript
import { spawn } from 'child_process';

const agentProcess = spawn('claude', [
  'code',
  'agent',
  'package-planning-writer',
  '--input', JSON.stringify(agentInput),
  '--output', planPath
]);
```

### Step 3: Wait for Completion

```typescript
await new Promise((resolve, reject) => {
  let stdout = '';
  let stderr = '';

  agentProcess.stdout?.on('data', (data) => {
    stdout += data.toString();
  });

  agentProcess.stderr?.on('data', (data) => {
    stderr += data.toString();
  });

  agentProcess.on('close', (code) => {
    if (code === 0) {
      resolve(stdout);
    } else {
      reject(new Error(`Agent failed with code ${code}: ${stderr}`));
    }
  });

  // Timeout after 5 minutes
  setTimeout(() => {
    agentProcess.kill();
    reject(new Error('Agent invocation timed out'));
  }, 5 * 60 * 1000);
});
```

### Step 4: Verify Plan File

```typescript
if (!fs.existsSync(planPath)) {
  throw new Error(`Agent completed but plan file not found at ${planPath}`);
}

const planContent = await fs.promises.readFile(planPath, 'utf-8');
if (planContent.trim().length === 0) {
  throw new Error('Agent generated empty plan file');
}
```

### Step 5: Register with MCP

```typescript
await callMcpTool('packages_update', {
  id: input.packageName,
  data: {
    plan_file_path: planPath,
    plan_content: planContent,
    branch_name: branchName,
    status: 'planning'
  }
}, mcpServerUrl);
```

## Agent Contract

### Input Schema

```typescript
interface AgentInput {
  packageName: string;              // @bernierllc/package-name
  dependencies: Dependency[];       // List of dependencies
  purpose?: string;                 // Package purpose/description
  outputPath: string;               // Where to write the plan file
  metadata?: {
    requestedBy: string;            // Workflow ID that requested
    timestamp: number;              // Request timestamp
    priority?: 'high' | 'low';     // Request priority
  };
}

interface Dependency {
  name: string;                     // Dependency package name
  version: string;                  // Version or range
  type: 'internal' | 'external';   // Dependency classification
  required?: boolean;               // Is this a required dependency?
}
```

### Output Schema

```typescript
interface AgentOutput {
  success: boolean;
  planPath: string;
  sectionsGenerated: string[];      // e.g., ['Overview', 'Requirements', 'Implementation', 'Testing']
  warnings?: string[];              // Non-fatal issues
  error?: string;                   // Error message if success=false
}
```

### Plan File Format

The generated plan must be valid markdown with required sections:

```markdown
# Package Name

## Overview
Brief description of the package and its purpose.

## Requirements
- Functional requirements
- Non-functional requirements
- Dependencies and constraints

## Implementation
1. Step-by-step implementation tasks
2. Code structure and organization
3. Key implementation details

## Testing
- Unit test requirements
- Integration test scenarios
- Acceptance criteria
```

## Error Handling

### Fallback Strategy

If agent invocation fails, the activity should:

1. Log detailed error for debugging
2. Fall back to placeholder registration (current behavior)
3. Mark package status as 'needs-plan-manual' in MCP
4. Continue workflow execution (don't block)

```typescript
try {
  // Attempt agent invocation
  await invokeAgent(agentInput);
} catch (error) {
  console.error(`Agent invocation failed for ${input.packageName}:`, error);
  console.log('  Falling back to placeholder registration');

  // Register placeholder with special status
  await callMcpTool('packages_update', {
    id: input.packageName,
    data: {
      plan_file_path: planPath,
      status: 'needs-plan-manual',
      error: String(error)
    }
  }, mcpServerUrl);
}
```

### Timeout Handling

Agent invocation should have a reasonable timeout (e.g., 5 minutes):
- Long enough for complex plans
- Short enough to avoid workflow blocking
- Configurable via environment variable

### Retry Logic

Agent invocation should NOT retry automatically:
- Plan generation is idempotent but expensive
- Failures are likely systematic (missing context, invalid input)
- Manual intervention may be needed
- Plans Workflow can re-queue if needed

## Observability

### Logging

Agent invocation should log:
- Start time and input parameters
- Agent stdout/stderr in real-time
- Completion status and duration
- Plan file size and sections generated

### Metrics

Track via Temporal metrics:
- Agent invocation duration
- Success/failure rate
- Timeout rate
- Plan quality scores (if available)

### Temporal UI

Agent invocation appears in Temporal UI as:
- Activity execution under `generatePlanForPackage`
- Logs show agent progress
- Failures include agent error messages

## Testing

### Unit Tests

```typescript
describe('generatePlanForPackage with agent invocation', () => {
  it('should invoke agent and register plan', async () => {
    // Mock agent subprocess
    // Verify agent input is correct
    // Assert plan file is generated
    // Verify MCP registration
  });

  it('should fall back to placeholder on agent failure', async () => {
    // Mock agent subprocess to fail
    // Assert placeholder registration
    // Verify error is logged
  });

  it('should timeout after 5 minutes', async () => {
    // Mock agent subprocess to hang
    // Assert timeout occurs
    // Verify fallback behavior
  });
});
```

### Integration Tests

```typescript
describe('End-to-end agent invocation', () => {
  it('should generate plan when package not found', async () => {
    // Start Plans Workflow
    // Trigger build workflow for non-existent package
    // Verify agent is invoked
    // Assert plan is generated and registered
    // Verify polling succeeds
  });
});
```

## Configuration

### Environment Variables

```bash
# Agent configuration
AGENT_TIMEOUT_MS=300000           # 5 minutes
AGENT_COMMAND='claude code agent'  # Agent invocation command
PLAN_OUTPUT_DIR='/path/to/plans'  # Where to write plans

# MCP configuration
MCP_SERVER_URL='http://localhost:3355/api/mcp'
PACKAGES_API_TOKEN='...'
```

### Temporal Activity Configuration

```typescript
const { generatePlanForPackage } = proxyActivities<typeof activities>({
  startToCloseTimeout: '15 minutes',  // Includes agent invocation
  retry: {
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumAttempts: 1,  // No auto-retry for agent invocation
  },
});
```

## Future Enhancements

1. **Agent Response Streaming:** Stream agent output to Temporal logs in real-time
2. **Plan Quality Validation:** Validate plan quality before registration
3. **Multi-Agent Support:** Invoke different agents based on package type
4. **Caching:** Cache agent responses for similar packages
5. **Human-in-the-Loop:** Allow manual review before plan registration

## Related Files

- Implementation: `src/activities/planning.activities.ts:326`
- Workflow: `src/workflows/plans.workflow.ts`
- Tests: `src/activities/__tests__/planning.activities.test.ts`
- Integration Test: `src/workflows/__tests__/integration-test.md`

## References

- [Temporal Activities](https://docs.temporal.io/activities)
- [Node.js child_process](https://nodejs.org/api/child_process.html)
- [Claude Code Agents](https://docs.claude.com/claude-code/agents)
