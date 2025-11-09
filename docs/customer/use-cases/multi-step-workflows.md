# Use Case: Multi-Step Workflows

Complex workflows with multiple stages, conditional logic, and state management. Learn patterns for building sophisticated multi-agent systems.

## Overview

Multi-step workflows coordinate multiple agent interactions to accomplish complex tasks. They feature:

- Multiple sequential or parallel stages
- Stateful progression through stages
- Conditional branching based on results
- Error handling and retry logic
- Data passing between stages

## Pattern: Sequential Pipeline

Execute stages one after another, passing data forward.

### Use Case: Document Processing Pipeline

**Goal:** Extract text, analyze sentiment, generate summary

**Stages:**
```
1. Extract text from document
2. Analyze sentiment of text
3. Generate executive summary
4. Create final report
```

**Implementation:**

```typescript
export class DocumentPipelineSpec implements ISpec {
  readonly name = 'document-pipeline';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}`;

    // Track progress through pipeline
    const hasText = 'extractedText' in state.artifacts;
    const hasSentiment = 'sentiment' in state.artifacts;
    const hasSummary = 'summary' in state.artifacts;
    const hasReport = 'report' in state.artifacts;

    // Stage 1: Extract text
    if (!hasText) {
      return this.handleTextExtraction(state, resp, decisionId);
    }

    // Stage 2: Analyze sentiment
    if (hasText && !hasSentiment) {
      return this.handleSentimentAnalysis(state, resp, decisionId);
    }

    // Stage 3: Generate summary
    if (hasSentiment && !hasSummary) {
      return this.handleSummaryGeneration(state, resp, decisionId);
    }

    // Stage 4: Create report
    if (hasSummary && !hasReport) {
      return this.handleReportCreation(state, resp, decisionId);
    }

    // Pipeline complete
    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [],
      finalize: true,
    };
  }

  private handleTextExtraction(
    state: EngineState,
    resp: AgentResponse,
    decisionId: string
  ): EngineDecision {
    if (resp.status === 'OK' && resp.content?.text) {
      this.context.logger.info('Text extracted', {
        length: resp.content.text.length
      });

      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'ANNOTATE',
            key: 'extractedText',
            value: resp.content.text,
          },
          {
            type: 'REQUEST_WORK',
            workKind: 'analyze_sentiment',
            payload: { text: resp.content.text },
          },
        ],
        finalize: false,
      };
    }

    // Initial request
    const documentPath = (state.artifacts.input as any)?.documentPath;

    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [
        {
          type: 'REQUEST_WORK',
          workKind: 'extract_text',
          payload: { documentPath },
        },
      ],
      finalize: false,
    };
  }

  private handleSentimentAnalysis(
    state: EngineState,
    resp: AgentResponse,
    decisionId: string
  ): EngineDecision {
    if (resp.status === 'OK' && resp.content?.sentiment) {
      this.context.logger.info('Sentiment analyzed', {
        sentiment: resp.content.sentiment
      });

      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'ANNOTATE',
            key: 'sentiment',
            value: resp.content.sentiment,
          },
          {
            type: 'REQUEST_WORK',
            workKind: 'generate_summary',
            payload: {
              text: state.artifacts.extractedText,
              sentiment: resp.content.sentiment,
            },
          },
        ],
        finalize: false,
      };
    }

    return { decisionId, actions: [], finalize: false };
  }

  // Similar methods for handleSummaryGeneration and handleReportCreation...
}
```

**Run:**

```bash
node dist/cli.js run document-pipeline --config ./pipeline-config.json
```

## Pattern: Parallel Execution

Execute independent tasks simultaneously.

### Use Case: Content Generation

**Goal:** Generate blog post with image, SEO metadata, and social posts in parallel

**Implementation:**

```typescript
export class ContentGenSpec implements ISpec {
  readonly name = 'content-gen';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}`;

    // Check which parallel tasks are complete
    const hasArticle = 'article' in state.artifacts;
    const hasImage = 'image' in state.artifacts;
    const hasSEO = 'seo' in state.artifacts;
    const hasSocial = 'socialPosts' in state.artifacts;

    // Initial state - launch all parallel tasks
    if (!hasArticle && !hasImage && !hasSEO && !hasSocial) {
      this.context.logger.info('Starting parallel content generation');

      const topic = (state.artifacts.input as any)?.topic;

      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'REQUEST_WORK',
            workKind: 'write_article',
            payload: { topic, length: 'medium' },
          },
          {
            type: 'REQUEST_WORK',
            workKind: 'generate_image',
            payload: { topic, style: 'modern' },
          },
          {
            type: 'REQUEST_WORK',
            workKind: 'create_seo_metadata',
            payload: { topic },
          },
          {
            type: 'REQUEST_WORK',
            workKind: 'generate_social_posts',
            payload: { topic, platforms: ['twitter', 'linkedin'] },
          },
        ],
        finalize: false,
      };
    }

    // Store completed results
    const actions: any[] = [];

    if (resp.status === 'OK' && resp.content) {
      const stepInfo = state.openSteps[resp.stepId];

      if (stepInfo?.kind === 'write_article' && !hasArticle) {
        actions.push({
          type: 'ANNOTATE',
          key: 'article',
          value: resp.content,
        });
      } else if (stepInfo?.kind === 'generate_image' && !hasImage) {
        actions.push({
          type: 'ANNOTATE',
          key: 'image',
          value: resp.content,
        });
      } else if (stepInfo?.kind === 'create_seo_metadata' && !hasSEO) {
        actions.push({
          type: 'ANNOTATE',
          key: 'seo',
          value: resp.content,
        });
      } else if (stepInfo?.kind === 'generate_social_posts' && !hasSocial) {
        actions.push({
          type: 'ANNOTATE',
          key: 'socialPosts',
          value: resp.content,
        });
      }
    }

    // Check if all tasks complete
    const allComplete = hasArticle && hasImage && hasSEO && hasSocial;

    if (allComplete) {
      this.context.logger.info('All parallel tasks completed');
    }

    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions,
      finalize: allComplete,
    };
  }
}
```

## Pattern: Conditional Branching

Choose different paths based on intermediate results.

### Use Case: Code Review with Escalation

**Goal:** Review code, escalate to senior reviewer if issues found

**Implementation:**

```typescript
export class CodeReviewSpec implements ISpec {
  readonly name = 'code-review';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}`;

    const hasInitialReview = 'initialReview' in state.artifacts;
    const hasSeniorReview = 'seniorReview' in state.artifacts;

    // Stage 1: Initial review
    if (!hasInitialReview) {
      if (resp.status === 'OK' && resp.content) {
        const { issues, severity } = resp.content as {
          issues: any[];
          severity: 'low' | 'medium' | 'high';
        };

        this.context.logger.info('Initial review complete', {
          issueCount: issues.length,
          severity
        });

        // Store initial review
        const actions: any[] = [
          {
            type: 'ANNOTATE',
            key: 'initialReview',
            value: resp.content,
          },
        ];

        // Conditional: escalate if high severity
        if (severity === 'high' || issues.length > 10) {
          this.context.logger.info('Escalating to senior reviewer');

          actions.push({
            type: 'REQUEST_WORK',
            workKind: 'senior_review',
            payload: {
              code: state.artifacts.code,
              initialReview: resp.content,
              reason: 'High severity issues detected',
            },
          });

          return {
            decisionId,
            basedOn: { stepId: resp.stepId, runId: resp.runId },
            actions,
            finalize: false,
          };
        }

        // Low severity - no escalation needed
        return {
          decisionId,
          basedOn: { stepId: resp.stepId, runId: resp.runId },
          actions,
          finalize: true,
        };
      }

      // Request initial review
      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'REQUEST_WORK',
            workKind: 'initial_review',
            payload: { code: state.artifacts.code },
          },
        ],
        finalize: false,
      };
    }

    // Stage 2: Senior review (if escalated)
    if (hasInitialReview && !hasSeniorReview) {
      if (resp.status === 'OK' && resp.content) {
        this.context.logger.info('Senior review complete');

        return {
          decisionId,
          basedOn: { stepId: resp.stepId, runId: resp.runId },
          actions: [
            {
              type: 'ANNOTATE',
              key: 'seniorReview',
              value: resp.content,
            },
          ],
          finalize: true,
        };
      }
    }

    // Shouldn't reach here
    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [],
      finalize: true,
    };
  }
}
```

## Pattern: Map-Reduce

Process items in parallel, then aggregate results.

### Use Case: Batch Document Analysis

**Goal:** Analyze multiple documents in parallel, generate combined report

**Implementation:**

```typescript
export class BatchAnalysisSpec implements ISpec {
  readonly name = 'batch-analysis';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}`;

    const documents = (state.artifacts.input as any)?.documents || [];
    const hasReport = 'finalReport' in state.artifacts;

    // Collect analysis results
    const analyses = Object.entries(state.artifacts)
      .filter(([key]) => key.startsWith('analysis-'))
      .map(([_, value]) => value);

    // Stage 1: Map - analyze each document in parallel
    if (analyses.length === 0) {
      this.context.logger.info('Starting parallel document analysis', {
        documentCount: documents.length
      });

      const actions = documents.map((doc: any, index: number) => ({
        type: 'REQUEST_WORK' as const,
        workKind: 'analyze_document',
        payload: {
          documentId: doc.id,
          content: doc.content,
          index,
        },
      }));

      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions,
        finalize: false,
      };
    }

    // Store individual analysis results
    if (resp.status === 'OK' && resp.content && resp.content.index !== undefined) {
      const key = `analysis-${resp.content.index}`;

      if (!(key in state.artifacts)) {
        return {
          decisionId,
          basedOn: { stepId: resp.stepId, runId: resp.runId },
          actions: [
            {
              type: 'ANNOTATE',
              key,
              value: resp.content,
            },
          ],
          finalize: false,
        };
      }
    }

    // Stage 2: Reduce - all analyses complete, generate report
    if (analyses.length === documents.length && !hasReport) {
      this.context.logger.info('All analyses complete, generating report', {
        analysisCount: analyses.length
      });

      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'REQUEST_WORK',
            workKind: 'aggregate_analyses',
            payload: {
              analyses,
              documentCount: documents.length,
            },
          },
        ],
        finalize: false,
      };
    }

    // Store final report
    if (resp.status === 'OK' && resp.content && !hasReport) {
      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'ANNOTATE',
            key: 'finalReport',
            value: resp.content,
          },
        ],
        finalize: true,
      };
    }

    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [],
      finalize: hasReport,
    };
  }
}
```

## Pattern: Human-in-the-Loop

Pause for human approval before proceeding.

### Use Case: Deployment Approval

**Goal:** Prepare deployment, get approval, execute deployment

**Implementation:**

```typescript
export class DeploymentSpec implements ISpec {
  readonly name = 'deployment';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}`;

    const hasPreparation = 'preparation' in state.artifacts;
    const hasApproval = 'approval' in state.artifacts;
    const hasDeployment = 'deployment' in state.artifacts;

    // Stage 1: Prepare deployment
    if (!hasPreparation) {
      if (resp.status === 'OK' && resp.content) {
        this.context.logger.info('Deployment prepared');

        // Change workflow status to AWAITING_APPROVAL
        return {
          decisionId,
          basedOn: { stepId: resp.stepId, runId: resp.runId },
          actions: [
            {
              type: 'ANNOTATE',
              key: 'preparation',
              value: resp.content,
            },
            {
              type: 'ANNOTATE',
              key: '_status',
              value: 'AWAITING_APPROVAL',
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
            workKind: 'prepare_deployment',
            payload: state.artifacts.input,
          },
        ],
        finalize: false,
      };
    }

    // Stage 2: Wait for approval (handled externally)
    if (hasPreparation && !hasApproval) {
      // Workflow paused - waiting for external approval
      this.context.logger.info('Waiting for deployment approval');

      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [],
        finalize: false,
      };
    }

    // Stage 3: Execute deployment
    if (hasApproval && !hasDeployment) {
      if (resp.status === 'OK' && resp.content) {
        this.context.logger.info('Deployment complete');

        return {
          decisionId,
          basedOn: { stepId: resp.stepId, runId: resp.runId },
          actions: [
            {
              type: 'ANNOTATE',
              key: 'deployment',
              value: resp.content,
            },
          ],
          finalize: true,
        };
      }

      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'REQUEST_WORK',
            workKind: 'execute_deployment',
            payload: {
              preparation: state.artifacts.preparation,
              approval: state.artifacts.approval,
            },
          },
        ],
        finalize: false,
      };
    }

    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [],
      finalize: true,
    };
  }
}
```

## Error Handling Patterns

### Retry with Exponential Backoff

```typescript
onAgentError(state, workKind, error, attemptNumber): EngineDecision {
  const maxRetries = 5;
  const baseDelay = 1000;

  if (attemptNumber < maxRetries) {
    const delayMs = baseDelay * Math.pow(2, attemptNumber);

    this.context.logger.warn(`Retrying ${workKind} after ${delayMs}ms`, {
      attemptNumber,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      decisionId: `retry-${workKind}-${attemptNumber}`,
      actions: [
        {
          type: 'REQUEST_WORK',
          workKind,
          payload: {
            ...originalPayload,
            retryAttempt: attemptNumber + 1,
            retryDelay: delayMs,
          },
        },
      ],
      finalize: false,
    };
  }

  this.context.logger.error(`Max retries exceeded for ${workKind}`);

  return {
    decisionId: `fail-${workKind}`,
    actions: [
      {
        type: 'ANNOTATE',
        key: 'error',
        value: {
          workKind,
          error: error instanceof Error ? error.message : String(error),
          attemptNumber,
        },
      },
    ],
    finalize: true,
  };
}
```

### Fallback to Alternative Strategy

```typescript
onAgentError(state, workKind, error, attemptNumber): EngineDecision {
  if (workKind === 'ai_analysis' && attemptNumber === 1) {
    // First attempt with AI failed, try rule-based fallback
    this.context.logger.info('AI analysis failed, using fallback');

    return {
      decisionId: `fallback-${attemptNumber}`,
      actions: [
        {
          type: 'REQUEST_WORK',
          workKind: 'rule_based_analysis',
          payload: state.artifacts.input,
        },
      ],
      finalize: false,
    };
  }

  // No fallback available
  return {
    decisionId: `fail-${workKind}`,
    actions: [],
    finalize: true,
  };
}
```

## Best Practices

### 1. Clear Stage Tracking

Use explicit artifact keys to track progress:

```typescript
const stages = {
  hasStage1: 'stage1_result' in state.artifacts,
  hasStage2: 'stage2_result' in state.artifacts,
  hasStage3: 'stage3_result' in state.artifacts,
};
```

### 2. Pass Context Between Stages

Include relevant prior results in payloads:

```typescript
{
  type: 'REQUEST_WORK',
  workKind: 'stage2',
  payload: {
    inputData: originalInput,
    stage1Result: state.artifacts.stage1_result,
    metadata: { timestamp: context.now }
  }
}
```

### 3. Comprehensive Logging

Log at each stage transition:

```typescript
this.context.logger.info('Stage completed', {
  stage: 'analysis',
  duration: context.now - startTime,
  resultSize: JSON.stringify(result).length
});
```

### 4. Timeout Handling

Set appropriate timeouts for long-running stages:

```typescript
const STAGE_TIMEOUTS = {
  quick: 10000,
  medium: 30000,
  long: 120000,
};
```

### 5. Progress Monitoring

Track partial completion:

```typescript
const progress = {
  total: totalSteps,
  completed: Object.keys(state.artifacts).filter(k => k.startsWith('step-')).length
};

this.context.logger.info('Workflow progress', progress);
```

## Testing Multi-Step Workflows

```typescript
describe('DocumentPipelineSpec', () => {
  it('should execute all stages in sequence', async () => {
    const spec = new DocumentPipelineSpec(context);
    let state = createInitialState();

    // Stage 1
    let decision = spec.onAgentCompleted(state, bootResponse, execContext);
    expect(decision.actions[0].workKind).toBe('extract_text');

    // Stage 2
    const textResponse = createResponse('step-1', { text: 'Sample text' });
    decision = spec.onAgentCompleted(state, textResponse, execContext);
    expect(decision.actions).toHaveLength(2);
    expect(decision.actions[1].workKind).toBe('analyze_sentiment');

    // Continue through all stages...
  });

  it('should handle parallel execution', async () => {
    const spec = new ContentGenSpec(context);
    let state = createInitialState();

    // Launch parallel tasks
    let decision = spec.onAgentCompleted(state, bootResponse, execContext);
    expect(decision.actions).toHaveLength(4);

    // Complete tasks in any order
    const articleResponse = createResponse('step-1', { article: '...' });
    decision = spec.onAgentCompleted(state, articleResponse, execContext);
    expect(decision.finalize).toBe(false);

    // Final task completes workflow
    const socialResponse = createResponse('step-4', { posts: [...] });
    decision = spec.onAgentCompleted(state, socialResponse, execContext);
    expect(decision.finalize).toBe(true);
  });
});
```

## Next Steps

- [Integrating LLMs](integrating-llms.md) for AI-powered workflows
- [Simple Automation](simple-automation.md) for basic patterns
- [Create Custom Workflow](../how-to/create-custom-workflow.md) guide

## Related Documentation

- [Todo Workflow Guide](../how-to/run-todo-workflow.md)
- [Workflow Specs Reference](../reference/workflow-specs.md)
- [Configuration Reference](../reference/configuration.md)
