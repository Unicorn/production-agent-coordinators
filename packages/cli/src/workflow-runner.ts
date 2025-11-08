import { Container } from '@coordinator/coordinator';
import { HelloSpecFactory } from '@coordinator/specs-hello';
import { MockAgentFactory } from '@coordinator/agents-mock';
import { AnthropicAgentFactory } from '@coordinator/agent-anthropic';
import type { ILogger, ISpecFactory, IAgentFactory } from '@coordinator/contracts';
import type { CoordinatorConfig } from './config-loader.js';

export interface WorkflowOptions {
  spec: string;
  agent?: string;
  config: CoordinatorConfig;
  logger: ILogger;
}

export interface WorkflowResult {
  success: boolean;
  output?: any;
  error?: Error;
}

// Registry of available spec factories
const SPEC_REGISTRY: Record<string, ISpecFactory> = {
  'hello': new HelloSpecFactory(),
};

// Registry of available agent factories
const AGENT_REGISTRY: Record<string, IAgentFactory> = {
  'mock': new MockAgentFactory(),
  'anthropic': new AnthropicAgentFactory()
};

export async function runWorkflow(options: WorkflowOptions): Promise<WorkflowResult> {
  const { spec, config, logger } = options;
  const agentName = options.agent || config.defaultAgent;

  logger.info(`Starting workflow: ${spec}`);
  logger.info(`Using agent: ${agentName}`);

  // Check for error simulation (testing only)
  if ((config as any).simulateError) {
    logger.error('Simulated error occurred');
    return {
      success: false,
      error: new Error('Simulated error')
    };
  }

  try {
    // Get spec factory
    const specFactory = SPEC_REGISTRY[spec];
    if (!specFactory) {
      throw new Error(`Unknown spec: ${spec}`);
    }

    // Get agent factory
    const agentFactory = AGENT_REGISTRY[agentName];
    if (!agentFactory) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    logger.info('Initializing workflow components...');

    // Create container and register factories
    const container = new Container();

    // Register logger
    container.registerLogger(logger);
    // Note: Storage is optional for CLI usage

    // Register spec factory
    container.registerSpecFactory(specFactory);

    // Register agent factory
    container.registerAgentFactory(agentName, agentFactory);

    // Set API keys in config if available
    if (config.apiKeys[agentName]) {
      container.setConfig('apiKey', config.apiKeys[agentName]);
    }

    logger.info('Workflow initialized');

    // For now, return success as we've set up the infrastructure
    // Actual workflow execution would require Engine integration
    return {
      success: true,
      output: {
        spec: spec,
        agent: agentName,
        message: 'CLI infrastructure initialized successfully'
      }
    };
  } catch (error) {
    logger.error(`Workflow failed: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

export function listSpecs(): string[] {
  return Object.keys(SPEC_REGISTRY);
}

export function listAgents(): string[] {
  return Object.keys(AGENT_REGISTRY);
}

export function getSpecInfo(specName: string): { name: string; description: string } | null {
  const specFactory = SPEC_REGISTRY[specName];
  if (!specFactory) {
    return null;
  }

  const descriptor = specFactory.describe();
  return {
    name: specFactory.name,
    description: descriptor.description
  };
}

export function getAgentInfo(agentName: string): { name: string; description: string } | null {
  const agentFactory = AGENT_REGISTRY[agentName];
  if (!agentFactory) {
    return null;
  }

  const descriptor = agentFactory.describe();
  return {
    name: agentName,
    description: descriptor.description
  };
}
