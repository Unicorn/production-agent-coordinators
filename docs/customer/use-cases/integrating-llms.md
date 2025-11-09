# Use Case: Integrating LLMs

Learn how to effectively integrate Large Language Models (LLMs) like Claude into your workflows for intelligent, AI-powered automation.

## Overview

LLM integration enables:
- Natural language understanding and generation
- Intelligent decision-making
- Content creation and analysis
- Code generation and review
- Creative problem-solving

## Getting Started with Claude

### Basic Setup

```bash
# Set your API key
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Run with Claude agent
node dist/cli.js run hello --agent anthropic
```

### Configuration

```json
{
  "defaultAgent": "anthropic",
  "agents": {
    "anthropic": {
      "model": "claude-3-5-sonnet-20241022",
      "maxTokens": 4096,
      "temperature": 1.0
    }
  },
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}"
  }
}
```

## Use Case: Intelligent Code Review

**Goal:** Use Claude to review code and provide actionable feedback

**Implementation:**

```typescript
export class AICodeReviewSpec implements ISpec {
  readonly name = 'ai-code-review';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}`;

    if ('review' in state.artifacts) {
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
            key: 'review',
            value: resp.content,
          },
        ],
        finalize: true,
      };
    }

    // Request Claude to review code
    const code = (state.artifacts.input as any)?.code || '';
    const language = (state.artifacts.input as any)?.language || 'typescript';

    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [
        {
          type: 'REQUEST_WORK',
          workKind: 'ai_review',
          payload: {
            prompt: `Review this ${language} code and provide:
1. Overall code quality assessment
2. Potential bugs or issues
3. Performance concerns
4. Security vulnerabilities
5. Best practice violations
6. Specific improvement suggestions

Code:
\`\`\`${language}
${code}
\`\`\`

Provide your review in JSON format with these fields:
- quality: string (rating from 1-10)
- issues: array of {type, severity, line, message, suggestion}
- summary: string (brief overall assessment)
`,
          },
        },
      ],
      finalize: false,
    };
  }
}
```

## Use Case: Content Generation Pipeline

**Goal:** Generate blog content with Claude in multiple stages

**Stages:**
1. Generate outline
2. Write sections
3. Create meta description
4. Generate social posts

**Implementation:**

```typescript
export class BlogGenSpec implements ISpec {
  readonly name = 'blog-gen';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}`;

    const hasOutline = 'outline' in state.artifacts;
    const hasContent = 'content' in state.artifacts;
    const hasMeta = 'meta' in state.artifacts;
    const hasSocial = 'social' in state.artifacts;

    const topic = (state.artifacts.input as any)?.topic;

    // Stage 1: Generate outline
    if (!hasOutline) {
      if (resp.status === 'OK' && resp.content) {
        return {
          decisionId,
          basedOn: { stepId: resp.stepId, runId: resp.runId },
          actions: [
            {
              type: 'ANNOTATE',
              key: 'outline',
              value: resp.content,
            },
            {
              type: 'REQUEST_WORK',
              workKind: 'ai_generation',
              payload: {
                prompt: `Write a detailed blog post following this outline:
${JSON.stringify(resp.content, null, 2)}

Topic: ${topic}

Make it engaging, informative, and well-structured. Include examples and actionable insights.`,
              },
            },
          ],
          finalize: false,
        };
      }

      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'REQUEST_WORK',
            workKind: 'ai_generation',
            payload: {
              prompt: `Create a detailed outline for a blog post about: ${topic}

Include:
- Catchy title
- Introduction hook
- 3-5 main sections with subsections
- Key points for each section
- Conclusion approach

Provide as JSON with structure: {title, introduction, sections: [{heading, points: []}], conclusion}`,
            },
          },
        ],
        finalize: false,
      };
    }

    // Stage 2: Write content
    if (hasOutline && !hasContent) {
      if (resp.status === 'OK' && resp.content) {
        // Launch parallel tasks for meta and social
        return {
          decisionId,
          basedOn: { stepId: resp.stepId, runId: resp.runId },
          actions: [
            {
              type: 'ANNOTATE',
              key: 'content',
              value: resp.content,
            },
            {
              type: 'REQUEST_WORK',
              workKind: 'ai_generation',
              payload: {
                prompt: `Create SEO meta description for this blog post:
Title: ${state.artifacts.outline.title}
Content: ${JSON.stringify(resp.content).substring(0, 500)}...

Make it compelling, under 160 characters, keyword-rich.`,
              },
            },
            {
              type: 'REQUEST_WORK',
              workKind: 'ai_generation',
              payload: {
                prompt: `Create 3 social media posts promoting this blog:
Title: ${state.artifacts.outline.title}

1. Twitter post (280 chars max)
2. LinkedIn post (professional, 200 words)
3. Instagram caption (engaging, with hashtags)

Provide as JSON array.`,
              },
            },
          ],
          finalize: false,
        };
      }
    }

    // Store parallel results
    if (hasContent && resp.status === 'OK' && resp.content) {
      const stepInfo = state.openSteps[resp.stepId];

      if (stepInfo?.payload.prompt.includes('meta description') && !hasMeta) {
        return {
          decisionId,
          basedOn: { stepId: resp.stepId, runId: resp.runId },
          actions: [
            {
              type: 'ANNOTATE',
              key: 'meta',
              value: resp.content,
            },
          ],
          finalize: false,
        };
      }

      if (stepInfo?.payload.prompt.includes('social media') && !hasSocial) {
        return {
          decisionId,
          basedOn: { stepId: resp.stepId, runId: resp.runId },
          actions: [
            {
              type: 'ANNOTATE',
              key: 'social',
              value: resp.content,
            },
          ],
          finalize: hasMeta,
        };
      }
    }

    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [],
      finalize: hasMeta && hasSocial,
    };
  }
}
```

## Use Case: Interactive Q&A

**Goal:** Answer questions using Claude with context awareness

**Implementation:**

```typescript
export class QASpec implements ISpec {
  readonly name = 'qa';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}`;

    const question = (state.artifacts.input as any)?.question;
    const contextDocs = (state.artifacts.input as any)?.contextDocs || [];

    if ('answer' in state.artifacts) {
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
            key: 'answer',
            value: resp.content,
          },
        ],
        finalize: true,
      };
    }

    // Build context from documents
    const contextText = contextDocs
      .map((doc: any, i: number) => `Document ${i + 1}:\n${doc.content}`)
      .join('\n\n');

    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [
        {
          type: 'REQUEST_WORK',
          workKind: 'ai_generation',
          payload: {
            prompt: `Answer this question based on the provided context:

Question: ${question}

Context:
${contextText}

Instructions:
- Provide a clear, concise answer
- Cite specific documents when relevant
- If the answer isn't in the context, say so
- Include confidence level (high/medium/low)

Provide as JSON: {answer, citations: [], confidence, reasoning}`,
          },
        },
      ],
      finalize: false,
    };
  }
}
```

## Best Practices

### 1. Craft Effective Prompts

**Good prompt characteristics:**
- Clear instructions
- Specific output format
- Examples when needed
- Context provided upfront
- Constraints stated explicitly

**Example:**

```typescript
const prompt = `Analyze this code for security issues:

\`\`\`typescript
${code}
\`\`\`

Provide response as JSON:
{
  "issues": [
    {
      "type": "SQL_INJECTION" | "XSS" | "CSRF" | "AUTH" | "OTHER",
      "severity": "critical" | "high" | "medium" | "low",
      "line": number,
      "description": string,
      "recommendation": string
    }
  ],
  "overallRisk": "critical" | "high" | "medium" | "low",
  "summary": string
}

If no issues found, return empty issues array.`;
```

### 2. Handle Token Limits

```typescript
const MAX_TOKENS = 4096;
const estimatedPromptTokens = prompt.length / 4; // Rough estimate

if (estimatedPromptTokens > MAX_TOKENS * 0.8) {
  // Truncate or split prompt
  const truncatedContent = content.substring(0, MAX_TOKENS * 3); // ~3 chars per token
  prompt = `Analyze this code (truncated):\n${truncatedContent}...`;
}
```

### 3. Parse Structured Responses

```typescript
if (resp.status === 'OK' && resp.content) {
  try {
    // Extract JSON from response (may be wrapped in markdown)
    const jsonMatch = resp.content.match(/```json\n(.*?)\n```/s);
    const parsed = jsonMatch
      ? JSON.parse(jsonMatch[1])
      : JSON.parse(resp.content);

    return {
      actions: [{
        type: 'ANNOTATE',
        key: 'result',
        value: parsed
      }],
      finalize: true
    };
  } catch (error) {
    this.context.logger.error('Failed to parse AI response', error);
    // Handle parse error
  }
}
```

### 4. Cost Management

```typescript
// Use cheaper models for simple tasks
const modelByComplexity = {
  simple: 'claude-3-haiku-20240307',     // Fast, cheap
  medium: 'claude-3-5-sonnet-20241022',  // Balanced
  complex: 'claude-3-opus-20240229',     // Most capable
};

const model = determineComplexity(task) === 'simple'
  ? modelByComplexity.simple
  : modelByComplexity.medium;
```

### 5. Rate Limiting

```typescript
onAgentError(state, workKind, error, attemptNumber): EngineDecision {
  if (error.type === 'RATE_LIMIT') {
    const backoffMs = Math.pow(2, attemptNumber) * 1000;

    this.context.logger.warn(`Rate limited, waiting ${backoffMs}ms`);

    return {
      decisionId: `rate-limit-retry-${attemptNumber}`,
      actions: [{
        type: 'REQUEST_WORK',
        workKind,
        payload: {
          ...originalPayload,
          retryAfter: backoffMs
        }
      }],
      finalize: false
    };
  }
}
```

### 6. Response Validation

```typescript
function validateAIResponse(content: unknown): boolean {
  if (!content || typeof content !== 'object') {
    return false;
  }

  const required = ['answer', 'confidence'];
  return required.every(field => field in content);
}

if (resp.status === 'OK') {
  if (!validateAIResponse(resp.content)) {
    this.context.logger.error('Invalid AI response format');

    return {
      decisionId,
      actions: [{
        type: 'REQUEST_WORK',
        workKind,
        payload: {
          ...originalPayload,
          retry: true,
          previousResponse: resp.content
        }
      }],
      finalize: false
    };
  }
}
```

## Testing with LLMs

### Use Mock Agents in Tests

```typescript
describe('AICodeReviewSpec', () => {
  it('should handle successful review', async () => {
    // Use mock agent for tests
    const mockAgent = new MockAgent(context);

    const spec = new AICodeReviewSpec(context);
    // Test workflow logic without real API calls
  });
});
```

### Integration Tests with Real LLMs

```typescript
describe('AICodeReviewSpec integration', () => {
  // Only run if API key available
  const apiKey = process.env.ANTHROPIC_API_KEY;

  (apiKey ? it : it.skip)('should review real code', async () => {
    const agent = new AnthropicAgent({
      apiKeys: { anthropic: apiKey },
      storage,
      logger,
      config: {},
    });

    const result = await agent.execute(
      'ai_review',
      {
        prompt: 'Review this code: function test() { return 42; }'
      },
      context
    );

    expect(result.status).toBe('OK');
    expect(result.content).toHaveProperty('quality');
  });
});
```

## Advanced Patterns

### Chain of Thought

```typescript
const prompt = `Solve this problem step-by-step:

Problem: ${problem}

Think through it:
1. What is being asked?
2. What information do we have?
3. What approach should we use?
4. Work through the solution
5. Verify the answer

Provide your reasoning and final answer as JSON:
{
  "thinking": string,
  "steps": string[],
  "answer": string,
  "confidence": number
}`;
```

### Few-Shot Learning

```typescript
const prompt = `Classify the sentiment of user feedback.

Examples:
Input: "This product is amazing! Best purchase ever."
Output: {"sentiment": "positive", "confidence": 0.95}

Input: "Terrible experience. Never buying again."
Output: {"sentiment": "negative", "confidence": 0.98}

Input: "It's okay, nothing special."
Output: {"sentiment": "neutral", "confidence": 0.75}

Now classify this:
Input: "${userFeedback}"
Output:`;
```

### Self-Correction

```typescript
// First pass
const initialResult = await agent.execute('ai_generation', {
  prompt: `Generate a Python function to sort a list.`
});

// Self-review
const reviewResult = await agent.execute('ai_review', {
  prompt: `Review this code for correctness:
${initialResult.content}

Identify any issues and suggest improvements.`
});

// Regenerate if issues found
if (reviewResult.content.issues.length > 0) {
  const correctedResult = await agent.execute('ai_generation', {
    prompt: `Improve this code based on review:
Original: ${initialResult.content}
Issues: ${JSON.stringify(reviewResult.content.issues)}

Generate corrected version.`
  });
}
```

## Monitoring and Debugging

### Log Prompts and Responses

```typescript
this.context.logger.debug('AI request', {
  workKind,
  promptLength: payload.prompt.length,
  model: config.model
});

this.context.logger.debug('AI response', {
  status: resp.status,
  contentLength: JSON.stringify(resp.content).length,
  tokens: resp.metadata?.tokens
});
```

### Track Costs

```typescript
interface AIMetrics {
  requestCount: number;
  totalTokens: number;
  estimatedCost: number;
}

function updateMetrics(resp: AgentResponse, metrics: AIMetrics) {
  metrics.requestCount++;
  metrics.totalTokens += resp.metadata?.tokens || 0;
  metrics.estimatedCost += calculateCost(resp.metadata?.tokens, model);
}
```

## Next Steps

- [Multi-Step Workflows](multi-step-workflows.md) with LLMs
- [Configure Agents](../how-to/configure-agents.md) for Claude
- [Create Custom Workflow](../how-to/create-custom-workflow.md)

## Related Documentation

- [Agent Configuration](../how-to/configure-agents.md)
- [Configuration Reference](../reference/configuration.md)
- [Troubleshooting](../troubleshooting.md)
