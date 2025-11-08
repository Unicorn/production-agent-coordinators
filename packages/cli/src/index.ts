// Export all CLI functionality for programmatic use
export { parseCommand, type CLICommand } from './command-parser.js';
export { loadConfig, type CoordinatorConfig } from './config-loader.js';
export {
  runWorkflow,
  listSpecs,
  listAgents,
  getSpecInfo,
  getAgentInfo,
  type WorkflowOptions,
  type WorkflowResult
} from './workflow-runner.js';
