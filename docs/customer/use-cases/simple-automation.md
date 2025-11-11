# Use Case: Simple Automation

Single-step workflows for automating straightforward tasks. Learn patterns for building quick, reliable automation with Agent Coordinator.

## Overview

Simple automation workflows consist of a single agent interaction with minimal state management. They're perfect for:

- One-off tasks
- Quick prototypes
- Testing and development
- Simple integrations

## Pattern: Request and Complete

The most basic workflow pattern.

### Use Case: Generate Greeting

**Goal:** Generate a personalized greeting

**Workflow:**
```
1. Request greeting from agent
2. Store result
3. Complete
```

**Implementation:**

```typescript
// SimpleGreetSpec.ts
export class SimpleGreetSpec implements ISpec {
  readonly name = 'simple-greet';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    // Check if we have a greeting
    if ('greeting' in state.artifacts) {
      // Already have greeting, finalize
      return {
        decisionId: `decision-${context.now}`,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [],
        finalize: true,
      };
    }

    // Check if this is a greeting response
    if (resp.status === 'OK' && resp.content) {
      // Store greeting and complete
      return {
        decisionId: `decision-${context.now}`,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'ANNOTATE',
            key: 'greeting',
            value: resp.content,
          },
        ],
        finalize: true,
      };
    }

    // Request greeting
    return {
      decisionId: `decision-${context.now}`,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [
        {
          type: 'REQUEST_WORK',
          workKind: 'generate_greeting',
          payload: {
            name: 'Alice',
            language: 'English',
          },
        },
      ],
      finalize: false,
    };
  }
}
```

**Run:**

```bash
node dist/cli.js run simple-greet
```

**Output:**

```json
{
  "greeting": {
    "message": "Hello Alice! How can I help you today?",
    "language": "English"
  }
}
```

## Pattern: Transform Data

Process input data and return transformed output.

### Use Case: Format JSON

**Goal:** Format and validate JSON data

**Implementation:**

```typescript
export class FormatJSONSpec implements ISpec {
  readonly name = 'format-json';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}`;

    // Check for formatted output
    if ('formatted' in state.artifacts) {
      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [],
        finalize: true,
      };
    }

    // Process response
    if (resp.status === 'OK' && resp.content) {
      const { formatted, valid } = resp.content as {
        formatted: string;
        valid: boolean;
      };

      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'ANNOTATE',
            key: 'formatted',
            value: formatted,
          },
          {
            type: 'ANNOTATE',
            key: 'valid',
            value: valid,
          },
        ],
        finalize: true,
      };
    }

    // Request formatting
    const inputJSON = (state.artifacts.input as any)?.json || '{}';

    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [
        {
          type: 'REQUEST_WORK',
          workKind: 'format_json',
          payload: {
            json: inputJSON,
            indent: 2,
          },
        },
      ],
      finalize: false,
    };
  }
}
```

**Custom Agent:**

```typescript
export class JSONFormatterAgent implements IAgent {
  async execute(
    workKind: string,
    payload: unknown
  ): Promise<AgentResult> {
    const { json, indent } = payload as { json: string; indent: number };

    try {
      // Parse JSON
      const parsed = JSON.parse(json);

      // Format with indentation
      const formatted = JSON.stringify(parsed, null, indent);

      return {
        status: 'OK',
        content: {
          formatted,
          valid: true,
        },
      };
    } catch (error) {
      return {
        status: 'FAIL',
        errors: [
          {
            type: 'VALIDATION_ERROR',
            message: `Invalid JSON: ${error.message}`,
          },
        ],
      };
    }
  }
}
```

## Pattern: Validation

Validate input and provide feedback.

### Use Case: Email Validation

**Goal:** Validate email addresses

**Implementation:**

```typescript
export class EmailValidationSpec implements ISpec {
  readonly name = 'validate-email';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}`;

    if ('validation' in state.artifacts) {
      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [],
        finalize: true,
      };
    }

    if (resp.status === 'OK' && resp.content) {
      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'ANNOTATE',
            key: 'validation',
            value: resp.content,
          },
        ],
        finalize: true,
      };
    }

    const email = (state.artifacts.input as any)?.email || '';

    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [
        {
          type: 'REQUEST_WORK',
          workKind: 'validate_email',
          payload: { email },
        },
      ],
      finalize: false,
    };
  }
}
```

**Custom Agent:**

```typescript
export class EmailValidatorAgent implements IAgent {
  async execute(
    workKind: string,
    payload: unknown
  ): Promise<AgentResult> {
    const { email } = payload as { email: string };

    // Simple email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);

    // Extract parts
    const parts = email.split('@');
    const [localPart, domain] = parts;

    return {
      status: 'OK',
      content: {
        email,
        valid: isValid,
        localPart,
        domain,
        warnings: isValid ? [] : ['Invalid email format'],
      },
    };
  }
}
```

**Output:**

```json
{
  "validation": {
    "email": "alice@example.com",
    "valid": true,
    "localPart": "alice",
    "domain": "example.com",
    "warnings": []
  }
}
```

## Pattern: External API Call

Call external APIs and process results.

### Use Case: Weather Lookup

**Goal:** Get current weather for a location

**Implementation:**

```typescript
export class WeatherSpec implements ISpec {
  readonly name = 'weather';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}`;

    if ('weather' in state.artifacts) {
      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [],
        finalize: true,
      };
    }

    if (resp.status === 'OK' && resp.content) {
      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'ANNOTATE',
            key: 'weather',
            value: resp.content,
          },
        ],
        finalize: true,
      };
    }

    const location = (state.artifacts.input as any)?.location || 'San Francisco';

    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [
        {
          type: 'REQUEST_WORK',
          workKind: 'fetch_weather',
          payload: { location },
        },
      ],
      finalize: false,
    };
  }
}
```

**Custom Agent:**

```typescript
import axios from 'axios';

export class WeatherAgent implements IAgent {
  constructor(private context: AgentContext) {}

  async execute(
    workKind: string,
    payload: unknown
  ): Promise<AgentResult> {
    const { location } = payload as { location: string };
    const apiKey = this.context.apiKeys.weatherApi;

    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather`,
        {
          params: {
            q: location,
            appid: apiKey,
            units: 'metric',
          },
        }
      );

      const { main, weather, wind } = response.data;

      return {
        status: 'OK',
        content: {
          location,
          temperature: main.temp,
          condition: weather[0].description,
          humidity: main.humidity,
          windSpeed: wind.speed,
        },
      };
    } catch (error) {
      return {
        status: 'FAIL',
        errors: [
          {
            type: 'PROVIDER_ERROR',
            message: `Weather API error: ${error.message}`,
            retryable: true,
          },
        ],
      };
    }
  }
}
```

## Pattern: File Operations

Read, write, or transform files.

### Use Case: Generate Report

**Goal:** Generate a markdown report

**Implementation:**

```typescript
export class ReportSpec implements ISpec {
  readonly name = 'generate-report';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}`;

    if ('report' in state.artifacts) {
      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [],
        finalize: true,
      };
    }

    if (resp.status === 'OK' && resp.content) {
      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'ANNOTATE',
            key: 'report',
            value: resp.content,
          },
        ],
        finalize: true,
      };
    }

    const data = state.artifacts.input as any;

    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [
        {
          type: 'REQUEST_WORK',
          workKind: 'generate_report',
          payload: {
            title: data.title || 'Report',
            data: data.data || [],
          },
        },
      ],
      finalize: false,
    };
  }
}
```

**Custom Agent:**

```typescript
export class ReportGeneratorAgent implements IAgent {
  constructor(private context: AgentContext) {}

  async execute(
    workKind: string,
    payload: unknown
  ): Promise<AgentResult> {
    const { title, data } = payload as { title: string; data: any[] };

    // Generate markdown
    let markdown = `# ${title}\n\n`;
    markdown += `Generated: ${new Date().toISOString()}\n\n`;

    markdown += '## Data\n\n';
    data.forEach((item, index) => {
      markdown += `${index + 1}. ${JSON.stringify(item)}\n`;
    });

    // Write to storage
    const filename = `report-${Date.now()}.md`;
    await this.context.storage.write(filename, markdown);

    return {
      status: 'OK',
      content: {
        filename,
        path: await this.context.storage.getPath(filename),
        size: markdown.length,
      },
    };
  }
}
```

## Best Practices

### 1. Keep It Simple

Single-step workflows should do one thing well:

```typescript
// Good - focused task
export class GreetSpec {
  // Just generates greeting
}

// Bad - too much in one spec
export class GreetAndAnalyzeAndReportSpec {
  // Multiple complex operations
}
```

### 2. Use Appropriate Agents

Match agent type to task:

```typescript
// Good - mock for deterministic data
node dist/cli.js run validate-email --agent mock

// Good - Claude for AI tasks
node dist/cli.js run generate-greeting --agent anthropic

// Good - custom agent for specific operations
node dist/cli.js run fetch-weather --agent weather
```

### 3. Handle Errors Gracefully

```typescript
if (resp.status === 'FAIL') {
  // Log error
  this.context.logger.error('Task failed', resp.errors);

  // Store error for debugging
  return {
    actions: [{
      type: 'ANNOTATE',
      key: 'error',
      value: resp.errors
    }],
    finalize: true
  };
}
```

### 4. Validate Input

```typescript
// Validate input early
const email = (state.artifacts.input as any)?.email;

if (!email) {
  return {
    actions: [{
      type: 'ANNOTATE',
      key: 'error',
      value: { message: 'Email required' }
    }],
    finalize: true
  };
}
```

### 5. Use Configuration

Make specs configurable:

```typescript
export class ValidatorSpecFactory implements ISpecFactory {
  describe(): SpecDescriptor {
    return {
      name: 'validator',
      configSchema: {
        type: 'object',
        properties: {
          strictMode: { type: 'boolean', default: false },
          maxLength: { type: 'number', default: 255 }
        }
      }
    };
  }
}
```

## Common Patterns

### Retry on Failure

```typescript
onAgentError(state, workKind, error, attemptNumber): EngineDecision {
  if (attemptNumber < 3) {
    return {
      decisionId: `retry-${attemptNumber}`,
      actions: [{ type: 'REQUEST_WORK', workKind, payload: {...} }],
      finalize: false
    };
  }
  return { actions: [], finalize: true };
}
```

### Timeout Handling

```typescript
const TIMEOUT_MS = 30000;

if (resp.status === 'TIMEOUT') {
  return {
    actions: [{
      type: 'ANNOTATE',
      key: 'error',
      value: { message: 'Request timed out', timeout: TIMEOUT_MS }
    }],
    finalize: true
  };
}
```

### Caching Results

```typescript
// Check cache first
const cached = await this.context.storage.read(`cache-${key}`);
if (cached) {
  return {
    actions: [{
      type: 'ANNOTATE',
      key: 'result',
      value: JSON.parse(cached.toString())
    }],
    finalize: true
  };
}

// Otherwise request work
return {
  actions: [{ type: 'REQUEST_WORK', workKind: 'fetch_data', ... }],
  finalize: false
};
```

## Testing

Test simple workflows with mock agents:

```typescript
describe('SimpleGreetSpec', () => {
  it('should request and complete greeting', async () => {
    const spec = new SimpleGreetSpec(context);
    const state = createInitialState();

    // First call - request work
    let decision = spec.onAgentCompleted(state, bootResponse, execContext);
    expect(decision.actions[0].type).toBe('REQUEST_WORK');

    // Second call - complete
    const response = {
      stepId: 'step-1',
      runId: 'run-1',
      status: 'OK',
      content: { message: 'Hello!' }
    };

    decision = spec.onAgentCompleted(state, response, execContext);
    expect(decision.finalize).toBe(true);
  });
});
```

## Next Steps

- [Multi-Step Workflows](multi-step-workflows.md) for complex automation
- [Integrating LLMs](integrating-llms.md) for AI-powered tasks
- [Create Custom Workflow](../how-to/create-custom-workflow.md) guide

## Related Documentation

- [Hello Workflow Guide](../how-to/run-hello-workflow.md)
- [Workflow Specs Reference](../reference/workflow-specs.md)
- [Agent Configuration](../how-to/configure-agents.md)
