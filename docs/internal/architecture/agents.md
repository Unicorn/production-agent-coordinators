# Agent Architecture

**Interface:** `IAgent`, `IAgentFactory`
**Location:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/interfaces.ts`
**Implementations:** `packages/agents/mock/`, `packages/agents/anthropic/`
**Dependencies:** `@coordinator/contracts` ONLY

## Purpose

Agents execute work requested by specs. They are the "hands" of the system - they call LLMs, run tools, interact with APIs, or perform any other concrete action. Agents return results without knowing what the spec will do with them.

## Design Philosophy

### WHY Agents Exist

Agents provide:

1. **Execution Abstraction:** Specs don't know how work is done
2. **Provider Flexibility:** Swap LLM providers, models, or tools
3. **Testability:** Mock agents for spec testing
4. **Composability:** Different agents for different work kinds

### WHY Agents Cannot Depend on Engine

**CRITICAL RULE:** Agents depend on `contracts` ONLY, never `engine`.

**REASONS:**

1. **Prevent Circular Dependency:** Engine calls agents → Agents cannot use Engine
2. **Enable Dynamic Loading:** Agents loaded as plugins cannot require engine
3. **Clean Separation:** Agents don't need workflow knowledge
4. **Future Plugin System:** Hot-reload agents without engine restart

**ENFORCED BY:** TypeScript references in `tsconfig.json`

## IAgent Interface

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/interfaces.ts`

```typescript
interface IAgent {
  execute(
    workKind: string,
    payload: unknown,
    context: AgentExecutionContext
  ): Promise<AgentResult>;
}
```

### execute

**PURPOSE:** Perform work and return result.

**PARAMETERS:**
- `workKind`: Type of work to perform (e.g., 'GENERATE_CODE')
- `payload`: Work-specific data (spec-defined)
- `context`: Execution context with runId, goalId, constraints

**RETURNS:** `AgentResult` with status, content, artifacts, metrics

**EXAMPLE:**

```typescript
async execute(
  workKind: string,
  payload: unknown,
  context: AgentExecutionContext
): Promise<AgentResult> {
  if (workKind === 'GENERATE_CODE') {
    const { prompt, language } = payload as CodeGenPayload;

    try {
      const code = await this.llm.generate({
        prompt,
        language,
        maxTokens: context.constraints?.maxTokens,
      });

      return {
        status: 'OK',
        content: { code, language },
        metrics: {
          tokens: { prompt: 150, completion: 500 },
          latencyMs: 2500,
        },
      };
    } catch (error) {
      return {
        status: 'FAIL',
        errors: [{
          type: 'PROVIDER_ERROR',
          message: error.message,
          retryable: true,
        }],
      };
    }
  }

  throw new Error(`Unsupported work kind: ${workKind}`);
}
```

## IAgentFactory Interface

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/interfaces.ts`

```typescript
interface IAgentFactory {
  readonly supportedWorkKinds: string[];

  create(context: AgentContext): IAgent;
  describe(): AgentDescriptor;
}
```

### supportedWorkKinds

**PURPOSE:** Declare which work kinds this agent supports.

**USED BY:** Coordinator to route work to appropriate agent.

**EXAMPLE:**

```typescript
readonly supportedWorkKinds = [
  'GENERATE_CODE',
  'REFACTOR_CODE',
  'REVIEW_CODE',
  'GENERATE_TESTS',
];
```

### create

**PURPOSE:** Create agent instance with injected dependencies.

**PARAMETERS:**
- `context`: AgentContext with storage, logger, apiKeys, config

**RETURNS:** IAgent instance

**EXAMPLE:**

```typescript
create(context: AgentContext): IAgent {
  return new AnthropicAgent(context);
}
```

### describe

**PURPOSE:** Provide metadata about agent without instantiation.

**RETURNS:** AgentDescriptor with name, version, capabilities

**EXAMPLE:**

```typescript
describe(): AgentDescriptor {
  return {
    name: 'anthropic-agent',
    version: '1.0.0',
    description: 'Claude-powered agent for code generation',
    supportedWorkKinds: this.supportedWorkKinds,
    capabilities: {
      streaming: true,
      functionCalling: true,
    },
  };
}
```

## AgentResult Structure

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/types.ts:86-95`

```typescript
interface AgentResult<T = unknown> {
  status: 'OK' | 'PARTIAL' | 'FAIL' | 'RATE_LIMITED' | 'CONTEXT_EXCEEDED';
  content?: T;
  artifacts?: AgentResponse['artifacts'];
  metrics?: AgentResponse['metrics'];
  llmMetadata?: AgentResponse['llmMetadata'];
  confidence?: AgentResponse['confidence'];
  errors?: AgentResponse['errors'];
  provenance?: AgentResponse['provenance'];
}
```

### Status Values

**OK:** Work completed successfully
**PARTIAL:** Work partially completed (e.g., code gen but not tests)
**FAIL:** Work failed (unrecoverable error)
**RATE_LIMITED:** Provider rate limit hit (retryable)
**CONTEXT_EXCEEDED:** Prompt too long for model (need shorter prompt)

### Optional Fields

**content:** Work result (code, text, JSON, etc.)
**artifacts:** Array of files/URLs produced
**metrics:** Token usage, cost, latency
**llmMetadata:** Model ID, temperature, stop reason
**confidence:** Agent's confidence in result
**errors:** Error details if status != OK
**provenance:** Agent ID, version, execution ID

## AgentExecutionContext

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/types.ts:98-122`

```typescript
interface AgentExecutionContext {
  runId: string;
  goalId: string;
  workflowType: string;
  stepNumber: number;
  totalSteps?: number;
  previousSteps?: Array<{
    workKind: string;
    status: string;
    summary?: string;
  }>;
  annotations?: Record<string, unknown>;
  constraints?: {
    maxTokens?: number;
    maxCostUsd?: number;
    timeoutMs?: number;
    modelPreference?: string;
  };
  traceId: string;
  spanId: string;
  cacheContext?: {
    systemPromptHash?: string;
    conversationId?: string;
  };
}
```

**PURPOSE:** Provide agent with workflow context for:
- Logging/tracing (runId, goalId, traceId)
- Cost control (constraints.maxCostUsd)
- Prompt engineering (previousSteps, annotations)
- Caching (cacheContext)

## Error Handling

### Error Taxonomy

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/types.ts:69-76`

```typescript
type ErrorType =
  | 'RATE_LIMIT'           // Provider rate limiting (retryable)
  | 'CONTEXT_EXCEEDED'     // Prompt too long (need shorter prompt)
  | 'INVALID_REQUEST'      // Malformed request (not retryable)
  | 'PROVIDER_ERROR'       // Provider-side error (may be retryable)
  | 'VALIDATION_ERROR'     // Response validation failed (not retryable)
  | 'TIMEOUT';             // Execution timeout (may be retryable)
```

### Error Mapping

Agents must map provider-specific errors to taxonomy:

```typescript
try {
  const result = await provider.call(request);
  return { status: 'OK', content: result };
} catch (error) {
  // Map provider error to taxonomy
  if (error.code === 'rate_limit_exceeded') {
    return {
      status: 'RATE_LIMITED',
      errors: [{
        type: 'RATE_LIMIT',
        message: error.message,
        retryable: true,
        retryAfterMs: error.retryAfterSeconds * 1000,
      }],
    };
  }

  if (error.code === 'context_length_exceeded') {
    return {
      status: 'CONTEXT_EXCEEDED',
      errors: [{
        type: 'CONTEXT_EXCEEDED',
        message: 'Prompt exceeds model context window',
        retryable: false,
        details: { maxTokens: error.maxTokens, usedTokens: error.usedTokens },
      }],
    };
  }

  // Generic error
  return {
    status: 'FAIL',
    errors: [{
      type: 'PROVIDER_ERROR',
      message: error.message,
      retryable: false,
    }],
  };
}
```

## Example: MockAgent

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/agents/mock/src/mock-agent.ts`

**PURPOSE:** Deterministic agent for testing specs.

```typescript
export class MockAgentFactory implements IAgentFactory {
  readonly supportedWorkKinds: string[];

  constructor(workKinds: string[]) {
    this.supportedWorkKinds = workKinds;
  }

  create(context: AgentContext): IAgent {
    return new MockAgent(context, this.supportedWorkKinds);
  }

  describe(): AgentDescriptor {
    return {
      name: 'mock-agent',
      version: '1.0.0',
      description: 'Deterministic mock agent for testing',
      supportedWorkKinds: this.supportedWorkKinds,
      capabilities: {
        streaming: false,
        functionCalling: false,
      },
    };
  }
}

class MockAgent implements IAgent {
  constructor(
    private context: AgentContext,
    private supportedWorkKinds: string[]
  ) {}

  async execute(
    workKind: string,
    payload: unknown,
    execContext: AgentExecutionContext
  ): Promise<AgentResult> {
    if (!this.supportedWorkKinds.includes(workKind)) {
      return {
        status: 'FAIL',
        errors: [{
          type: 'INVALID_REQUEST',
          message: `Unsupported work kind: ${workKind}`,
          retryable: false,
        }],
      };
    }

    // Deterministic response
    return {
      status: 'OK',
      content: {
        message: `Mock result for ${workKind}`,
        payload,
        executedAt: execContext.stepNumber,
      },
      metrics: {
        latencyMs: 100,
      },
    };
  }
}
```

## Example: AnthropicAgent

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/agents/anthropic/src/anthropic-agent.ts`

**PURPOSE:** Claude-powered agent for LLM tasks.

**IMPLEMENTATION HIGHLIGHTS:**

```typescript
class AnthropicAgent implements IAgent {
  private client: Anthropic;

  constructor(private context: AgentContext) {
    const apiKey = context.apiKeys['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not provided');
    }
    this.client = new Anthropic({ apiKey });
  }

  async execute(
    workKind: string,
    payload: unknown,
    execContext: AgentExecutionContext
  ): Promise<AgentResult> {
    try {
      const prompt = this.buildPrompt(workKind, payload, execContext);
      const model = (execContext.constraints?.modelPreference ||
                     this.context.config.model) as string ?? 'claude-3-5-sonnet-20241022';

      const response = await this.client.messages.create({
        model,
        max_tokens: execContext.constraints?.maxTokens ?? 4096,
        messages: [{ role: 'user', content: prompt }],
      });

      return {
        status: 'OK',
        content: this.parseResponse(response),
        metrics: {
          tokens: {
            prompt: response.usage.input_tokens,
            completion: response.usage.output_tokens,
          },
          modelName: model,
        },
        llmMetadata: {
          modelId: model,
          stopReason: response.stop_reason,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private buildPrompt(
    workKind: string,
    payload: unknown,
    context: AgentExecutionContext
  ): string {
    // Build context-aware prompt
    let prompt = `You are performing: ${workKind}\n\n`;

    if (context.previousSteps?.length) {
      prompt += 'Previous steps:\n';
      for (const step of context.previousSteps) {
        prompt += `- ${step.workKind}: ${step.status}\n`;
      }
      prompt += '\n';
    }

    prompt += `Task: ${JSON.stringify(payload, null, 2)}`;

    return prompt;
  }

  private handleError(error: any): AgentResult {
    if (error.status === 429) {
      return {
        status: 'RATE_LIMITED',
        errors: [{
          type: 'RATE_LIMIT',
          message: 'Anthropic rate limit exceeded',
          retryable: true,
          retryAfterMs: 60000,
        }],
      };
    }

    // ... handle other error types

    return {
      status: 'FAIL',
      errors: [{
        type: 'PROVIDER_ERROR',
        message: error.message,
        retryable: false,
      }],
    };
  }
}
```

## Agent Implementation Patterns

### Pattern 1: Simple LLM Call

```typescript
async execute(workKind, payload, context): Promise<AgentResult> {
  const prompt = `Perform ${workKind}: ${JSON.stringify(payload)}`;

  const response = await llm.call(prompt);

  return {
    status: 'OK',
    content: response.text,
  };
}
```

### Pattern 2: Function Calling

```typescript
async execute(workKind, payload, context): Promise<AgentResult> {
  const tools = [
    {
      name: 'read_file',
      description: 'Read a file from disk',
      parameters: { path: { type: 'string' } },
    },
    {
      name: 'write_file',
      description: 'Write a file to disk',
      parameters: { path: { type: 'string' }, content: { type: 'string' } },
    },
  ];

  const response = await llm.call({
    prompt: `Perform ${workKind}`,
    tools,
  });

  // Execute tool calls
  for (const toolCall of response.toolCalls) {
    if (toolCall.name === 'write_file') {
      await this.context.storage.write(
        toolCall.parameters.path,
        toolCall.parameters.content
      );
    }
  }

  return {
    status: 'OK',
    content: response.text,
    artifacts: response.toolCalls.map(tc => ({
      type: 'file',
      ref: tc.parameters.path,
    })),
  };
}
```

### Pattern 3: Streaming

```typescript
async execute(workKind, payload, context): Promise<AgentResult> {
  const stream = await llm.stream(prompt);

  let fullText = '';

  for await (const chunk of stream) {
    fullText += chunk.text;

    // Optionally: stream to storage
    await this.context.storage.write(
      `stream-${context.runId}.txt`,
      fullText
    );
  }

  return {
    status: 'OK',
    content: { text: fullText },
  };
}
```

### Pattern 4: Multi-Step Tool Agent

```typescript
async execute(workKind, payload, context): Promise<AgentResult> {
  if (workKind === 'RUN_TESTS') {
    // Step 1: Read test files
    const testFiles = await this.context.storage.list('tests/');

    // Step 2: Run tests
    const results = [];
    for (const file of testFiles) {
      const content = await this.context.storage.read(file);
      const result = await this.testRunner.run(content.toString());
      results.push({ file, result });
    }

    // Step 3: Generate report
    const report = this.generateReport(results);
    const reportPath = await this.context.storage.write(
      'test-report.json',
      JSON.stringify(report)
    );

    return {
      status: 'OK',
      content: { summary: report.summary },
      artifacts: [{
        type: 'report',
        url: reportPath,
        meta: report,
      }],
    };
  }
}
```

## Testing Agents

### Unit Tests

Test agent logic in isolation:

```typescript
describe('AnthropicAgent', () => {
  let agent: AnthropicAgent;
  let mockClient: MockAnthropicClient;

  beforeEach(() => {
    mockClient = new MockAnthropicClient();
    agent = new AnthropicAgent({
      storage: mockStorage,
      logger: mockLogger,
      apiKeys: { ANTHROPIC_API_KEY: 'test-key' },
      config: {},
    });
    // Inject mock client
    (agent as any).client = mockClient;
  });

  it('should call LLM with correct prompt', async () => {
    mockClient.mockResponse({ text: 'Result' });

    const result = await agent.execute('GENERATE_CODE', { prompt: 'Test' }, mockContext);

    expect(mockClient.lastRequest).toMatchObject({
      model: 'claude-3-5-sonnet-20241022',
      messages: expect.arrayContaining([
        expect.objectContaining({ content: expect.stringContaining('Test') }),
      ]),
    });
  });

  it('should handle rate limit errors', async () => {
    mockClient.mockError({ status: 429, message: 'Rate limit' });

    const result = await agent.execute('GENERATE_CODE', {}, mockContext);

    expect(result.status).toBe('RATE_LIMITED');
    expect(result.errors?.[0].retryable).toBe(true);
  });
});
```

### Mock Validation Tests

**CRITICAL** (per project guidelines): Mocks must match real behavior.

```typescript
describe('MockAgent validation', () => {
  it('should match AnthropicAgent response schema', async () => {
    const mockAgent = new MockAgent(context, ['GENERATE_CODE']);
    const mockResult = await mockAgent.execute('GENERATE_CODE', {}, execContext);

    // Validate against expected schema
    expect(mockResult).toMatchObject({
      status: expect.stringMatching(/^(OK|FAIL|PARTIAL|RATE_LIMITED|CONTEXT_EXCEEDED)$/),
      content: expect.any(Object),
    });

    // Ensure required fields present
    expect(mockResult.status).toBeDefined();
  });

  it('should periodically re-record mocks', async () => {
    // This test should be run manually when AnthropicAgent changes
    // to ensure mock responses stay in sync
    const realAgent = new AnthropicAgent(realContext);
    const realResult = await realAgent.execute('GENERATE_CODE', testPayload, execContext);

    // Save as mock template
    await fs.writeFile(
      'mocks/anthropic-generate-code.json',
      JSON.stringify(realResult, null, 2)
    );
  });
});
```

## Best Practices

### 1. Validate Work Kind

```typescript
// ✅ GOOD: Check if work kind is supported
if (!this.supportedWorkKinds.includes(workKind)) {
  return {
    status: 'FAIL',
    errors: [{ type: 'INVALID_REQUEST', message: `Unsupported: ${workKind}`, retryable: false }],
  };
}

// ❌ BAD: Throw error
if (!this.supportedWorkKinds.includes(workKind)) {
  throw new Error(`Unsupported work kind`);
}
```

### 2. Map Provider Errors

```typescript
// ✅ GOOD: Map to error taxonomy
catch (error) {
  if (error.code === 'rate_limit') {
    return { status: 'RATE_LIMITED', errors: [{ type: 'RATE_LIMIT', ... }] };
  }
}

// ❌ BAD: Generic error
catch (error) {
  return { status: 'FAIL', errors: [{ type: 'PROVIDER_ERROR', message: error.message }] };
}
```

### 3. Use Storage for Artifacts

```typescript
// ✅ GOOD: Store artifacts via storage
const path = await this.context.storage.write('output.json', JSON.stringify(data));
return {
  status: 'OK',
  artifacts: [{ type: 'json', url: path }],
};

// ❌ BAD: Return inline
return {
  status: 'OK',
  content: { data: largeObject },  // May exceed state size limits
};
```

### 4. Log Agent Activity

```typescript
// ✅ GOOD: Log key events
this.context.logger.info('Agent executing', { workKind, runId: context.runId });
this.context.logger.info('Agent completed', { status: 'OK', latency: elapsed });

// ❌ BAD: Silent execution
// (no logging)
```

## Related Documentation

- [Overview](./overview.md) - System architecture
- [Engine](./engine.md) - How agents are called
- [Specs](./specs.md) - How work is requested
- [API: Contracts](../api/contracts.md) - Interface definitions
- [Development: Adding Packages](../development/adding-packages.md) - Create new agent

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-09 | Internal Docs Agent | Initial creation |
