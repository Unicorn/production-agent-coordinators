# How to Configure Agents

Agents are the execution layer of Agent Coordinator. This guide shows you how to configure and use different agent types for your workflows.

## What You'll Learn

- How to set up and configure different agent types
- How to manage API keys securely
- How to create custom agents
- How to switch between agents for different workflows

## Available Agent Types

Agent Coordinator supports multiple agent types:

| Agent Type | Best For | Requires API Key |
|------------|----------|------------------|
| **Mock** | Testing, development, CI/CD | No |
| **Anthropic** | Production AI workflows | Yes |
| **Custom** | Specialized tools, integrations | Varies |

## Mock Agents

Mock agents return predefined responses perfect for testing.

### Configuration

No configuration needed! Mock agents work out of the box:

```bash
node dist/cli.js run hello --agent mock
```

### Behavior

Mock agents provide deterministic responses:

```typescript
// MockAgent for "greet" work kind
{
  status: 'OK',
  content: {
    message: 'Hello! This is a mock greeting.'
  }
}
```

### Use Cases

- **Unit testing** - Test spec logic without external dependencies
- **CI/CD pipelines** - Fast, reliable tests
- **Development** - Iterate quickly without API costs
- **Demo environments** - Consistent, predictable behavior

### Customizing Mock Responses

Edit `packages/agents/mock/src/mock-agent.ts`:

```typescript
async execute(workKind: string, payload: unknown): Promise<AgentResult> {
  if (workKind === 'greet') {
    return {
      status: 'OK',
      content: {
        message: 'Custom greeting!',  // Your custom response
      },
    };
  }

  // Default response
  return {
    status: 'OK',
    content: { message: `Completed ${workKind}` },
  };
}
```

Rebuild:

```bash
yarn workspace @coordinator/agents-mock build
```

## Anthropic Agents (Claude)

Anthropic agents use Claude for intelligent task execution.

### Setup

1. **Get API Key**

   Visit [Anthropic Console](https://console.anthropic.com/) to create an API key.

2. **Set Environment Variable**

   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

   Or add to your shell profile:

   ```bash
   # ~/.bashrc or ~/.zshrc
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

3. **Verify Configuration**

   ```bash
   echo $ANTHROPIC_API_KEY
   ```

### Usage

Run workflows with Claude:

```bash
node dist/cli.js run hello --agent anthropic
```

### Configuration Options

Create `.coordinatorrc`:

```json
{
  "defaultAgent": "anthropic",
  "agents": {
    "anthropic": {
      "model": "claude-3-5-sonnet-20241022",
      "maxTokens": 4096,
      "temperature": 1.0,
      "timeout": 30000
    }
  },
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}"
  }
}
```

**Configuration parameters:**

- **model** - Claude model to use
  - `claude-3-5-sonnet-20241022` (default, recommended)
  - `claude-3-opus-20240229` (most capable)
  - `claude-3-haiku-20240307` (fastest, cheapest)

- **maxTokens** - Maximum response length (default: 4096)

- **temperature** - Randomness (0.0 = deterministic, 1.0 = creative)

- **timeout** - Request timeout in milliseconds

### Rate Limiting

Claude has rate limits. The agent handles this automatically:

```typescript
// Agent detects rate limit
{
  status: 'RATE_LIMITED',
  errors: [{
    type: 'RATE_LIMIT',
    message: 'Rate limit exceeded',
    retryable: true,
    retryAfterMs: 60000
  }]
}
```

Your spec can implement retry logic:

```typescript
onAgentError(state, workKind, error, attemptNumber): EngineDecision {
  if (error.retryable && attemptNumber < 3) {
    // Wait and retry
    return {
      actions: [{ type: 'REQUEST_WORK', workKind, payload: {...} }],
      finalize: false
    };
  }
  // Give up
  return { actions: [], finalize: true };
}
```

### Cost Management

Monitor Claude API usage:

```bash
# Enable cost tracking
DEBUG=coordinator:anthropic node dist/cli.js run todo
```

**Tips to reduce costs:**

1. Use cheaper models for simple tasks:
   ```json
   {
     "specs": {
       "hello": {
         "agent": { "model": "claude-3-haiku-20240307" }
       }
     }
   }
   ```

2. Reduce maxTokens for concise responses:
   ```json
   { "maxTokens": 1024 }
   ```

3. Use mock agents for development:
   ```bash
   node dist/cli.js run hello --agent mock
   ```

## Custom Agents

Create agents for specialized tasks like database queries, API calls, or file operations.

### Create a Custom Agent

1. **Create package structure:**

   ```bash
   mkdir -p packages/agents/database/src
   cd packages/agents/database
   ```

2. **Create package.json:**

   ```json
   {
     "name": "@coordinator/agents-database",
     "version": "0.1.0",
     "type": "module",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "dependencies": {
       "@coordinator/contracts": "*",
       "pg": "^8.11.0"
     }
   }
   ```

3. **Implement agent:**

   ```typescript
   // src/database-agent.ts
   import type { IAgent, IAgentFactory, AgentContext, AgentResult } from '@coordinator/contracts';
   import { Pool } from 'pg';

   export class DatabaseAgent implements IAgent {
     private pool: Pool;

     constructor(private context: AgentContext) {
       this.pool = new Pool({
         connectionString: context.config.databaseUrl as string,
       });
     }

     async execute(
       workKind: string,
       payload: unknown,
       context: AgentExecutionContext
     ): Promise<AgentResult> {
       try {
         if (workKind === 'query') {
           const { sql, params } = payload as { sql: string; params: any[] };

           this.context.logger.info('Executing database query', { sql });

           const result = await this.pool.query(sql, params);

           return {
             status: 'OK',
             content: {
               rows: result.rows,
               rowCount: result.rowCount,
             },
           };
         }

         return {
           status: 'FAIL',
           errors: [{
             type: 'INVALID_REQUEST',
             message: `Unknown work kind: ${workKind}`,
           }],
         };
       } catch (error) {
         this.context.logger.error('Database query failed', error);

         return {
           status: 'FAIL',
           errors: [{
             type: 'PROVIDER_ERROR',
             message: error instanceof Error ? error.message : String(error),
             retryable: true,
           }],
         };
       }
     }

     async cleanup(): Promise<void> {
       await this.pool.end();
     }
   }

   export class DatabaseAgentFactory implements IAgentFactory {
     readonly supportedWorkKinds = ['query', 'execute'];

     create(context: AgentContext): IAgent {
       return new DatabaseAgent(context);
     }

     describe() {
       return {
         name: 'database',
         version: '0.1.0',
         supportedWorkKinds: this.supportedWorkKinds,
         description: 'PostgreSQL database agent for queries and commands',
       };
     }
   }
   ```

4. **Register agent:**

   ```typescript
   // packages/cli/src/workflow-runner.ts
   import { DatabaseAgentFactory } from '@coordinator/agents-database';

   coordinator.registerAgent('database', new DatabaseAgentFactory());
   ```

5. **Configure:**

   ```json
   {
     "agents": {
       "database": {
         "databaseUrl": "postgresql://user:pass@localhost:5432/mydb"
       }
     }
   }
   ```

6. **Use in workflows:**

   ```bash
   node dist/cli.js run my-workflow --agent database
   ```

## Agent Selection Strategies

### Per-Workflow Agent

Configure different agents for different specs:

```json
{
  "specs": {
    "hello": {
      "defaultAgent": "mock"
    },
    "todo": {
      "defaultAgent": "anthropic"
    },
    "data-analysis": {
      "defaultAgent": "database"
    }
  }
}
```

### Per-Work-Kind Agent

Route work to specialized agents:

```typescript
// In your spec
onAgentCompleted(state, resp, context): EngineDecision {
  return {
    actions: [
      {
        type: 'REQUEST_WORK',
        workKind: 'ai_generation',  // Routes to Anthropic agent
        payload: { prompt: '...' }
      },
      {
        type: 'REQUEST_WORK',
        workKind: 'query',  // Routes to Database agent
        payload: { sql: '...' }
      }
    ],
    finalize: false
  };
}
```

Register multiple agents:

```typescript
coordinator.registerAgent('anthropic', new AnthropicAgentFactory());
coordinator.registerAgent('database', new DatabaseAgentFactory());

// Engine routes based on supportedWorkKinds
```

### Environment-Based Agent

```bash
# Development
export AGENT_MODE="mock"

# Staging
export AGENT_MODE="anthropic"

# Production
export AGENT_MODE="anthropic"
```

```json
{
  "defaultAgent": "${AGENT_MODE}"
}
```

## Security Best Practices

### 1. Never Commit API Keys

```bash
# .gitignore
.coordinatorrc
.env
*.key
```

### 2. Use Environment Variables

```bash
# .env (never commit this!)
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://...
```

```json
// .coordinatorrc
{
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}"
  },
  "agents": {
    "database": {
      "databaseUrl": "${DATABASE_URL}"
    }
  }
}
```

### 3. Rotate Keys Regularly

```bash
# Update API key
export ANTHROPIC_API_KEY="new-key"

# Verify
node dist/cli.js run hello --agent anthropic
```

### 4. Use Different Keys Per Environment

```bash
# Development
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY_DEV}"

# Production
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY_PROD}"
```

## Testing Agents

### Mock Validation

Per project guidelines, mocks must be validated against real agents:

```typescript
// packages/agents/mock/src/mock-agent.test.ts
describe('MockAgent validation', () => {
  it('should match AnthropicAgent response schema', async () => {
    const mockAgent = new MockAgent(context);
    const result = await mockAgent.execute('greet', {}, execContext);

    // Validate structure matches real agent
    expect(result).toMatchObject({
      status: expect.stringMatching(/^(OK|FAIL|PARTIAL|RATE_LIMITED)$/),
      content: expect.any(Object),
    });
  });

  it('should be updated when AnthropicAgent changes', async () => {
    // Re-record mock responses periodically
    // This test documents the need to sync mocks
  });
});
```

### Integration Tests

Test with real agents in controlled environments:

```typescript
describe('AnthropicAgent integration', () => {
  it('should execute greet work', async () => {
    const agent = new AnthropicAgent({
      apiKeys: { anthropic: process.env.ANTHROPIC_API_KEY },
      storage,
      logger,
      config: {},
    });

    const result = await agent.execute('greet', { message: 'Say hello' }, context);

    expect(result.status).toBe('OK');
    expect(result.content).toHaveProperty('message');
  });
});
```

Run with API key:

```bash
ANTHROPIC_API_KEY="your-key" yarn test:integration
```

## Troubleshooting

### "Agent not found"

List available agents:

```bash
node dist/cli.js list-agents
```

Ensure agent is registered in CLI.

### "Invalid API key"

Verify key is set:

```bash
echo $ANTHROPIC_API_KEY
```

Test key directly:

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}'
```

### "Rate limit exceeded"

Implement exponential backoff in spec:

```typescript
onAgentError(state, workKind, error, attemptNumber): EngineDecision {
  if (error.type === 'RATE_LIMIT' && attemptNumber < 5) {
    const backoffMs = Math.pow(2, attemptNumber) * 1000;

    // Wait and retry
    return {
      actions: [{
        type: 'REQUEST_WORK',
        workKind,
        payload: { ...originalPayload, retryAfter: backoffMs }
      }],
      finalize: false
    };
  }
}
```

### "Agent timeout"

Increase timeout in config:

```json
{
  "agents": {
    "anthropic": {
      "timeout": 60000
    }
  }
}
```

## Next Steps

- [Create custom workflows](create-custom-workflow.md) that use multiple agents
- [Learn CLI commands](use-cli.md) for agent management
- [Explore LLM integration patterns](../use-cases/integrating-llms.md)
- [Review configuration options](../reference/configuration.md)

## Related Documentation

- [CLI Commands Reference](../reference/cli-commands.md)
- [Configuration Reference](../reference/configuration.md)
- [Integrating LLMs Use Case](../use-cases/integrating-llms.md)
