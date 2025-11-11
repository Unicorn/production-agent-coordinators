import type {
  ISpec,
  ISpecFactory,
  SpecContext,
  SpecDescriptor,
  EngineState,
  AgentResponse,
  EngineDecision,
  SpecExecutionContext,
} from '@coordinator/contracts';

/**
 * HelloSpec - A simple Phase 1 workflow specification
 *
 * This spec implements a basic single-step workflow:
 * 1. Requests a "greet" work kind with "Say hello" prompt
 * 2. Returns COMPLETE when the agent responds
 */
export class HelloSpec implements ISpec {
  readonly name = 'hello';

  constructor(private readonly context: SpecContext) {}

  /**
   * Handles agent completion events
   *
   * Logic:
   * - If no greet step exists, request one
   * - If greet step completed, annotate result and finalize
   */
  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    // Check if we have a greet step in progress
    const hasGreetStep = Object.values(state.openSteps).some(
      step => step.kind === 'greet'
    );

    if (!hasGreetStep) {
      // No greet step yet - request one
      this.context.logger.info('Requesting greeting work');

      return {
        decisionId: `decision-${context.now}-${Math.floor(context.random() * 1000000)}`,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'REQUEST_WORK',
            workKind: 'greet',
            payload: { message: 'Say hello' },
          },
        ],
        finalize: false,
      };
    }

    // Greet step exists and agent responded - finalize workflow
    this.context.logger.info('Greeting completed, finalizing workflow', {
      content: resp.content,
    });

    return {
      decisionId: `decision-${context.now}-${Math.floor(context.random() * 1000000)}`,
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

  /**
   * Handles agent errors with simple retry logic
   */
  onAgentError(
    _state: EngineState,
    workKind: string,
    error: unknown,
    attemptNumber: number
  ): EngineDecision {
    const maxRetries = 3;

    if (attemptNumber < maxRetries) {
      this.context.logger.warn(`Agent error on attempt ${attemptNumber}, retrying`, {
        workKind,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        decisionId: `retry-${Date.now()}-${attemptNumber}`,
        actions: [
          {
            type: 'REQUEST_WORK',
            workKind,
            payload: { message: 'Say hello' },
          },
        ],
        finalize: false,
      };
    }

    this.context.logger.error('Max retries exceeded, failing workflow', error instanceof Error ? error : undefined);

    return {
      decisionId: `fail-${Date.now()}`,
      actions: [],
      finalize: true,
    };
  }
}

/**
 * Factory for creating HelloSpec instances
 */
export class HelloSpecFactory implements ISpecFactory {
  readonly name = 'hello';
  readonly version = '1.0.0';

  create(context: SpecContext): ISpec {
    return new HelloSpec(context);
  }

  describe(): SpecDescriptor {
    return {
      name: this.name,
      version: this.version,
      description: 'Simple hello world workflow - requests greeting and completes',
      requiredWorkKinds: ['greet'],
      configSchema: {},
    };
  }

  validate(_config: unknown): boolean {
    // No configuration required for this simple spec
    return true;
  }
}
