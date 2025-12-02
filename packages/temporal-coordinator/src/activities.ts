import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import Handlebars from 'handlebars';
import Anthropic from '@anthropic-ai/sdk';

const execPromise = promisify(exec); // Directly assign

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Temporal Activities for Agent Coordinator
 *
 * Activities are functions that perform side effects and can fail/retry.
 * They wrap the existing Engine, Coordinator, and Agent components.
 */

import type {
  EngineState,
  AgentResponse,
  StepState,
  SpecExecutionContext,
} from '@coordinator/contracts';
import type { PackageBuildReport } from '@coordinator/agent-package-builder-production';
import { Engine } from '@coordinator/engine';
import { Container, Coordinator, ConsoleLogger } from '@coordinator/coordinator';
import { LocalFileStorage } from '@coordinator/storage';
import { HelloSpecFactory } from '@coordinator/specs-hello';
import { MockAgentFactory } from '@coordinator/agents-mock';

/**
 * Helper activity to set up a clean workspace
 */
export async function setupWorkspace(basePath: string): Promise<string> {
    const runId = randomUUID();
    const dir = path.join(basePath, `build-${runId}`);
    await fs.mkdir(dir, { recursive: true });
    console.log(`[Activity] Created workspace: ${dir}`);
    return dir;
}

/**
 * Logs an audit entry to audit_trace.jsonl in the working directory.
 */
export async function logAuditEntry(workingDir: string, entry: Partial<OptimizationLogEntry>) {
  const logPath = path.join(workingDir, 'audit_trace.jsonl');
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
  await fs.appendFile(logPath, line);
  console.log(`[Activity] Logged audit entry for step: ${entry.step_name}`);
}

/**
 * Executes the Gemini CLI in headless mode.
 */
export async function executeGeminiAgent({ instruction, workingDir, contextContent }: GeminiAgentInput): Promise<GeminiAgentResult> {
  console.log(`[Activity] Executing Gemini Agent in ${workingDir} with instruction: ${instruction.substring(0, 100)}...`);

  // 1. Inject Context (The "Fresh Brain" Strategy)
  if (contextContent) {
    await fs.writeFile(path.join(workingDir, 'GEMINI.md'), contextContent);
    console.log(`[Activity] Wrote GEMINI.md to ${workingDir}`);
  }

  // 2. Construct the CLI Command (Updated for new Gemini CLI syntax)
  // --yolo: Auto-executes file creation/shell commands (Dangerous but necessary for agents)
  // -o json: Returns structured data we can parse
  // Note: New CLI uses positional prompt and doesn't have --context flag
  // We tell Gemini to read the GEMINI.md file in the instruction itself
  // IMPORTANT: Add explicit warning to prevent ImportProcessor from trying to import package names
  const fullInstruction = contextContent
    ? `First, read the GEMINI.md file in the current directory for project requirements and context. 

CRITICAL: Do NOT use import statements with package names. Use only relative imports like "./file" or "../file". The ImportProcessor should NOT try to import packages by name.

Then: ${instruction}`
    : `CRITICAL: Do NOT use import statements with package names. Use only relative imports like "./file" or "../file". The ImportProcessor should NOT try to import packages by name.

${instruction}`;

  // Escape the instruction for shell and use positional prompt syntax
  const escapedInstruction = fullInstruction.replace(/'/g, "'\\''");
  const command = `gemini '${escapedInstruction}' --yolo -o json`;

  try {
    const { stdout, stderr } = await execPromise(command, { cwd: workingDir });

    // 3. Parse the JSON output from the CLI
    // Note: Sometimes CLIs output "thinking" text before JSON.
    // In production, use a regex to extract the JSON block.
    try {
        const result = JSON.parse(stdout);
        return {
            success: true,
            agentResponse: result,
            stderr: stderr // Capture warnings
        };
    } catch (parseError) {
        console.warn(`[Activity] Failed to parse JSON from Gemini CLI stdout. Raw output: ${stdout.substring(0, 500)}...`);
        // Fallback if raw text returned
        return { success: true, rawOutput: stdout, stderr };
    }

  } catch (error: any) {
    // Capture full error details
    const stderr = error.stderr || '';
    const stdout = error.stdout || '';
    const message = error.message || 'Unknown error';
    
    // Try to extract error report file path from stderr or stdout
    let actualError = message;
    let errorReportPath: string | null = null;
    
    // Check stderr first
    const stderrMatch = stderr.match(/Full report available at: (.+\.json)/);
    if (stderrMatch) {
      errorReportPath = stderrMatch[1];
    } else {
      // Check stdout
      const stdoutMatch = stdout.match(/Full report available at: (.+\.json)/);
      if (stdoutMatch) {
        errorReportPath = stdoutMatch[1];
      }
    }
    
    // If we found an error report path, try to read it
    if (errorReportPath) {
      try {
        const errorReportContent = await fs.readFile(errorReportPath, 'utf-8');
        const errorReport = JSON.parse(errorReportContent);
        if (errorReport.error?.message) {
          actualError = errorReport.error.message;
          // Include stack trace if available (first few lines)
          if (errorReport.error.stack) {
            const stackLines = errorReport.error.stack.split('\n').slice(0, 3);
            actualError += `\nStack: ${stackLines.join('\n')}`;
          }
        }
      } catch (readError: any) {
        // If we can't read the error report, log and fall back
        console.warn(`[Activity] Could not read error report at ${errorReportPath}: ${readError.message}`);
      }
    } else {
      // Try to find the most recent error report file as fallback
      try {
        const tmpDir = '/var/folders/r0/wspnzd1s18sfjy10ffyv2qxw0000gn/T';
        const files = await fs.readdir(tmpDir);
        const errorReports = files
          .filter(f => f.startsWith('gemini-client-error-') && f.endsWith('.json'))
          .map(f => ({ name: f, path: `${tmpDir}/${f}` }));
        
        if (errorReports.length > 0) {
          // Get the most recently modified file
          const stats = await Promise.all(
            errorReports.map(async (f) => ({
              ...f,
              mtime: (await fs.stat(f.path)).mtime.getTime()
            }))
          );
          const mostRecent = stats.sort((a, b) => b.mtime - a.mtime)[0];
          
          try {
            const errorReportContent = await fs.readFile(mostRecent.path, 'utf-8');
            const errorReport = JSON.parse(errorReportContent);
            if (errorReport.error?.message) {
              actualError = errorReport.error.message;
              console.log(`[Activity] Found error in most recent report: ${mostRecent.name}`);
            }
          } catch (readError: any) {
            console.warn(`[Activity] Could not read most recent error report: ${readError.message}`);
          }
        }
      } catch (dirError: any) {
        // If we can't access the temp directory, that's okay
        console.warn(`[Activity] Could not search for error reports: ${dirError.message}`);
      }
    }
    
    // Build comprehensive error message
    let errorMsg = `Gemini CLI failed: ${actualError}`;
    if (stderr && !stderr.includes(actualError) && stderr.length > 0) {
      errorMsg += `\nStderr: ${stderr.substring(0, 500)}`;
    }
    if (stdout && !stdout.includes('{') && !stdout.includes(actualError) && stdout.length > 0) {
      // Include stdout if it's not JSON (might contain error info)
      errorMsg += `\nStdout: ${stdout.substring(0, 500)}`;
    }
    
    console.error(`[Activity] ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

/**
 * Runs the BernierLLC compliance checks.
 * @param workingDir The directory where the package is built.
 */
export async function runComplianceChecks(workingDir: string): Promise<ComplianceCheckResult> {
  console.log(`[Activity] Running compliance checks in: ${workingDir}`);
  const commands = [
    'npm install', // Ensure all dependencies from scaffolding are present
    'npm run build', // Check TypeScript compilation and .d.ts generation
    'npm run lint',  // Check code quality with zero issues
    'npm test'     // Check test pass and coverage
  ];

  const results: string[] = [];
  const errors: ComplianceCheckResult['errors'] = [];
  
  for (const cmd of commands) {
    results.push(`--- RUNNING: ${cmd} ---`);
    console.log(`[Activity] Executing: ${cmd} in ${workingDir}`);
    try {
      const { stdout, stderr } = await execPromise(cmd, { cwd: workingDir });
      results.push(`SUCCESS: ${cmd}`);
      results.push(`STDOUT:\n${stdout}`);
      if (stderr) {
        results.push(`STDERR (Warnings?):\n${stderr}`);
      }
    } catch (error: any) {
      // Failure! Capture the entire error log and return.
      const errorDetails = `STDOUT: ${error.stdout}\nSTDERR: ${error.stderr || error.message}`;
      const errorMessage = `FAILURE DETECTED at command: ${cmd}`;

      errors.push({
        type: cmd.includes('install') ? 'npm install failure' :
              cmd.includes('build') ? 'build error' :
              cmd.includes('lint') ? 'lint error' :
              cmd.includes('test') ? 'test failure' : 'unknown command failure',
        message: errorMessage,
        details: errorDetails
      });

      const fullErrorLog = [
        errorMessage,
        errorDetails,
        `FULL LOG:\n${results.join('\n')}`
      ].join('\n');
      
      console.error(`[Activity] Compliance check failed: ${errorMessage}`);
      return { success: false, output: fullErrorLog, commandsRun: commands, errors };
    }
  }
  
  console.log(`[Activity] All compliance checks passed in: ${workingDir}`);
  return { success: true, output: results.join('\n'), commandsRun: commands };
}

/**
 * Initialize a workflow with the given goal ID and configuration
 */
export async function initializeWorkflow(
  goalId: string,
  config: {
    specType: string;
    specConfig?: Record<string, unknown>;
    agentType: string;
    agentConfig?: Record<string, unknown>;
  }
): Promise<EngineState> {
  console.log(`[Activity] Initializing workflow for goal: ${goalId}`);

  const initialState: EngineState = {
    goalId,
    status: 'RUNNING',
    openSteps: {},
    artifacts: {},
    log: [{
      at: Date.now(),
      event: 'WORKFLOW_INITIALIZED',
      data: { specType: config.specType, agentType: config.agentType },
    }],
  };

  console.log(`[Activity] Initial state created:`, {
    goalId: initialState.goalId,
    status: initialState.status,
  });

  return initialState;
}

/**
 * Execute a single workflow step by getting decision from spec
 * and processing it with the engine
 */
export async function executeSpecDecision(
  state: EngineState,
  config: {
    specType: string;
    specConfig?: Record<string, unknown>;
    lastResponse?: AgentResponse;
  }
): Promise<EngineState> {
  console.log(`[Activity] Executing spec decision for goal: ${state.goalId}`);

  // Setup container and coordinator
  const container = new Container();
  container.registerStorage(new LocalFileStorage('/tmp/coordinator'));
  container.registerLogger(new ConsoleLogger('TEMPORAL'));

  const coordinator = new Coordinator(container);

  // Register spec factory
  const helloFactory = new HelloSpecFactory();
  coordinator.registerSpec(helloFactory);

  // Create spec instance
  const spec = coordinator.createSpec(config.specType, config.specConfig || {});

  // Create execution context (deterministic)
  const execContext: SpecExecutionContext = {
    now: Date.now(),
    random: () => Math.random(), // In production, use seeded random
  };

  // Get decision from spec
  const decision = config.lastResponse
    ? spec.onAgentCompleted(state, config.lastResponse, execContext)
    : spec.onAgentCompleted(
        state,
        {
          goalId: state.goalId,
          workflowId: 'temporal-workflow',
          stepId: '',
          runId: '',
          agentRole: '',
          status: 'OK',
        },
        execContext
      );

  console.log(`[Activity] Spec decision:`, {
    decisionId: decision.decisionId,
    actions: decision.actions.length,
    finalize: decision.finalize,
  });

  // Process decision with engine
  const engine = new Engine(state);
  const newState = engine.processDecision(decision, execContext);

  console.log(`[Activity] New state:`, {
    status: newState.status,
    openSteps: Object.keys(newState.openSteps).length,
  });

  return newState;
}

/**
 * Execute a single agent step
 */
export async function executeAgentStep(
  goalId: string,
  stepId: string,
  step: StepState,
  config: {
    agentType: string;
    agentConfig?: Record<string, unknown>;
    agentApiKey?: string;
  }
): Promise<AgentResponse> {
  console.log(`[Activity] Executing agent step: ${stepId}`);
  console.log(`[Activity] Work kind: ${step.kind}`);

  // Setup container and coordinator
  const container = new Container();
  container.registerStorage(new LocalFileStorage('/tmp/coordinator'));
  container.registerLogger(new ConsoleLogger('TEMPORAL'));

  const coordinator = new Coordinator(container);

  // Register agent factory based on type
  if (config.agentType === 'mock-agent') {
    const mockFactory = new MockAgentFactory([step.kind]);
    coordinator.registerAgent('mock-agent', mockFactory);
  }
  // Add support for other agent types here (e.g., AnthropicAgent)

  // Create agent instance with config that includes mock response
  const agentConfig = config.agentConfig || {};
  if (config.agentType === 'mock-agent') {
    agentConfig.defaultResponse = {
      status: 'OK',
      content: {
        message: 'Hello from Temporal + Agent Coordinator!',
        timestamp: new Date().toISOString(),
        stepKind: step.kind,
      },
    };
  }

  const agent = coordinator.createAgent(
    config.agentType,
    config.agentApiKey ? { apiKey: config.agentApiKey } : {},
    agentConfig
  );

  // Execute agent
  const result = await agent.execute(step.kind, step.payload, {
    runId: `run-${Date.now()}`,
    goalId,
    workflowType: 'temporal-workflow',
    stepNumber: 1,
    traceId: `trace-${goalId}`,
    spanId: `span-${stepId}`,
  });

  // Convert to AgentResponse
  const response: AgentResponse = {
    goalId,
    workflowId: 'temporal-workflow',
    stepId,
    runId: `run-${Date.now()}`,
    agentRole: 'agent',
    status: result.status,
    content: result.content,
    artifacts: result.artifacts,
    metrics: result.metrics,
    llmMetadata: result.llmMetadata,
    confidence: result.confidence,
    errors: result.errors,
  };

  console.log(`[Activity] Agent response:`, {
    stepId,
    status: response.status,
    hasContent: !!response.content,
  });

  return response;
}

/**
 * Store an artifact to persistent storage
 */
export async function storeArtifact(
  goalId: string,
  key: string,
  value: unknown
): Promise<void> {
  console.log(`[Activity] Storing artifact: ${key} for goal: ${goalId}`);

  const container = new Container();
  container.registerStorage(new LocalFileStorage('/tmp/coordinator'));
  container.registerLogger(new ConsoleLogger('TEMPORAL'));

  const storage = container.resolveStorage();

  // Store artifact as JSON
  const artifactKey = `${goalId}/artifacts/${key}.json`;
  await storage.write(artifactKey, JSON.stringify(value, null, 2));

  console.log(`[Activity] Artifact stored successfully at: ${artifactKey}`);
}

/**
 * Process agent response and update state
 */
export async function processAgentResponse(
  state: EngineState,
  response: AgentResponse
): Promise<EngineState> {
  console.log(`[Activity] Processing agent response for step: ${response.stepId}`);

  const execContext: SpecExecutionContext = {
    now: Date.now(),
    random: () => Math.random(),
  };

  const engine = new Engine(state);
  const newState = engine.processAgentResponse(response, execContext);

  console.log(`[Activity] State updated:`, {
    status: newState.status,
    openSteps: Object.keys(newState.openSteps).length,
  });

  return newState;
}

/**
 * Coordinator Activities - Implemented directly
 */

// Build Activity Types
export type PackageCategory = 'validator' | 'core' | 'utility' | 'service' | 'ui' | 'suite';

export interface BuildResult {
  success: boolean;
  duration: number;
  stdout: string;
  stderr: string;
}

export interface TestResult {
  success: boolean;
  duration: number;
  coverage: number;
  stdout: string;
  stderr: string;
}

export interface QualityFailure {
  type: string;
  message: string;
  file?: string;
  line?: number;
}

export interface QualityResult {
  passed: boolean;
  duration: number;
  failures: QualityFailure[];
  stdout: string;
}

export interface PublishResult {
  success: boolean;
  duration: number;
  stdout: string;
}

export interface BuildConfig {
  npmRegistry: string;
  npmToken: string;
  workspaceRoot: string;
  maxConcurrentBuilds: number;
  temporal: {
    address: string;
    namespace: string;
    taskQueue: string;
  };
  testing: {
    enableCoverage: boolean;
    minCoveragePercent: number;
    failOnError: boolean;
  };
  publishing: {
    dryRun: boolean;
    requireTests: boolean;
    requireCleanWorkingDirectory: boolean;
  };
}

export interface PackageNode {
  name: string;
  category: PackageCategory;
  dependencies: string[];
  layer: number;
  buildStatus: 'pending' | 'building' | 'completed' | 'failed';
}

export interface OptimizationLogEntry {
  workflow_run_id: string;          // Unique Temporal Workflow ID
  step_name: string;                // e.g., 'scaffold', 'implement_v1', 'fix_attempt_1', 'initial_verification'
  timestamp: string;                // UTC timestamp of completion (ISO 8601)
  prompt_token_count?: number;      // Estimated tokens in the instruction + GEMINI.md context.
  completion_token_count?: number;  // Estimated tokens in the agent's output.
  total_token_cost?: number;        // prompt_token_count + completion_token_count.
  context_file_hash?: string;       // SHA-256 hash of the full GEMINI.md content used for this step.
  validation_status?: 'pass' | 'fail' | 'N/A'; // Outcome of the step.
  validation_error_type?: string;   // e.g., 'TSC_ERROR', 'ESLINT_ERROR', 'JEST_FAILURE'.
  error_log_size_chars?: number;    // Character count of the error log fed back to the agent (for rework steps).
  rework_cost_factor?: number;      // Efficiency metric: Tokens spent for the fix vs. the size of the problem.
  files_touched?: string[];         // List of files created/modified by the agent in this step.
  error_full?: string | null;              // Full error log (truncated if very large for storage).
  commands_attempted?: string[];    // Commands run during validation for this step.
}

// The input for our activity
export interface GeminiAgentInput {
  instruction: string;      // The prompt (e.g., "Build the files...")
  workingDir: string;       // Where the CLI should run
  contextContent?: string;  // The content for GEMINI.md (your spec)
}

// The output from the Gemini CLI execution
export interface GeminiAgentResult {
  success: boolean;
  agentResponse?: any;      // Parsed JSON output from Gemini CLI
  rawOutput?: string;       // Raw stdout if JSON parsing fails or not available
  stderr?: string;          // Stderr from the CLI process
  // Token counts would go here if provided by the CLI
  // prompt_tokens?: number;
  // completion_tokens?: number;
}

export interface ComplianceCheckResult {
  success: boolean;
  output: string; // Combined stdout/stderr from all commands
  commandsRun: string[]; // List of commands that were attempted
  errors?: {
    type: string; // e.g., 'npm install failure', 'build error', 'lint error', 'test failure'
    message: string;
    details?: string;
  }[];
}

// Coordinator types
type ProblemType = 'BUILD_FAILURE' | 'TEST_FAILURE' | 'QUALITY_FAILURE' | 'ENVIRONMENT_ERROR';

interface Problem {
  type: ProblemType;
  error: {
    message: string;
    stack?: string;
    code?: string;
    stdout?: string;
    stderr?: string;
  };
  context: {
    packageName: string;
    packagePath: string;
    planPath: string;
    phase: string;
    attemptNumber: number;
  };
}

interface AgentRegistryEntry {
  name: string;
  path: string;
  capabilities: string[];
  problemTypes: ProblemType[];
  priority: number;
}

interface AgentRegistry {
  agents: AgentRegistryEntry[];
}

type CoordinatorDecision = 'RETRY' | 'DELEGATE' | 'ESCALATE' | 'FAIL';

interface CoordinatorAction {
  decision: CoordinatorDecision;
  agent?: string;
  task?: {
    type: string;
    instructions: string;
    context: Record<string, unknown>;
  };
  escalation?: {
    reason: string;
    waitForSignal: boolean;
    reportPath: string;
  };
  modifications?: string[];
  reasoning: string;
}

interface AgentExecutionResult {
  success: boolean;
  changes: string[];
  output: string;
}

/**
 * Strip markdown code blocks from text
 * Handles both JSON and plain text code block formats
 */
function stripMarkdownCodeBlocks(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers
  const match = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/)
  if (match) {
    return match[1].trim()
  }
  return text.trim()
}

// Load agent registry from ~/.claude/agents
export async function loadAgentRegistry(agentDir?: string): Promise<AgentRegistry> {
  const dir = agentDir || path.join(process.env.HOME || '~', '.claude/agents');

  const customAgents: AgentRegistryEntry[] = [];

  try {
    await fs.access(dir);
    const files = await fs.readdir(dir);
    const agentFiles = files.filter((f) => f.endsWith('.md'));

    for (const file of agentFiles) {
      const filePath = path.join(dir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        console.warn(`No frontmatter in ${file}, skipping`);
        continue;
      }

      try {
        const frontmatter = yaml.parse(frontmatterMatch[1]) as Record<string, unknown>;

        customAgents.push({
          name: (frontmatter.name as string) || file.replace('.md', ''),
          path: filePath,
          capabilities: (frontmatter.capabilities as string[]) || [],
          problemTypes: (frontmatter.problemTypes as ProblemType[]) || [],
          priority: (frontmatter.priority as number) || 50,
        });
      } catch (parseError) {
        console.warn(`Failed to parse frontmatter in ${file}, skipping:`, parseError);
        continue;
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read - use only built-in agents
  }

  const builtInAgents = getBuiltInAgents();
  return { agents: [...customAgents, ...builtInAgents] };
}

function getBuiltInAgents(): AgentRegistryEntry[] {
  return [
    {
      name: 'environment-setup',
      path: 'builtin',
      capabilities: ['shell', 'environment', 'permissions', 'PATH'],
      problemTypes: ['ENVIRONMENT_ERROR'],
      priority: 100,
    },
    {
      name: 'code-fix',
      path: 'builtin',
      capabilities: ['typescript', 'javascript', 'syntax', 'imports'],
      problemTypes: ['BUILD_FAILURE'],
      priority: 80,
    },
    {
      name: 'dependency-resolution',
      path: 'builtin',
      capabilities: ['npm', 'yarn', 'package.json', 'versions'],
      problemTypes: ['BUILD_FAILURE', 'TEST_FAILURE'],
      priority: 90,
    },
    {
      name: 'diagnostic',
      path: 'builtin',
      capabilities: ['analysis', 'debugging', 'logging'],
      problemTypes: ['BUILD_FAILURE', 'TEST_FAILURE', 'QUALITY_FAILURE'],
      priority: 50,
    },
  ];
}

// Analyze problem using Claude API
export async function analyzeProblem(
  problem: Problem,
  registry: AgentRegistry
): Promise<CoordinatorAction> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required. ' +
        'Please set it before running the coordinator activities.'
    );
  }

  // Load prompt template
  const templatePath = path.join(
    path.dirname(path.dirname(__dirname)),
    'agents/package-builder-production/dist/prompts/coordinator-analysis.hbs'
  );
  const templateContent = await fs.readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateContent);

  const prompt = template({
    problem,
    agents: registry.agents,
  });

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
    max_tokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096'),
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Expected text response from Claude');
  }

  // Strip markdown code blocks if present
  const cleanedText = stripMarkdownCodeBlocks(content.text)

  let action: CoordinatorAction;
  try {
    action = JSON.parse(cleanedText) as CoordinatorAction;
  } catch (error) {
    const parseError = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to parse Claude response as JSON: ${parseError}\n` +
        `Response content: ${content.text.substring(0, 500)}...`
    );
  }

  validateCoordinatorAction(action);

  return action;
}

function validateCoordinatorAction(action: CoordinatorAction): void {
  if (!action.decision) {
    throw new Error('CoordinatorAction must have decision field');
  }

  if (action.decision === 'DELEGATE' && (!action.agent || !action.task)) {
    throw new Error('DELEGATE decision requires agent and task fields');
  }

  if (action.decision === 'ESCALATE' && !action.escalation) {
    throw new Error('ESCALATE decision requires escalation field');
  }

  if (!action.reasoning) {
    throw new Error('CoordinatorAction must have reasoning field');
  }
}

// Write diagnostic report
export async function writeDiagnosticReport(
  problem: Problem,
  action: CoordinatorAction
): Promise<void> {
  const reportPath = action.escalation?.reportPath || '/tmp/coordinator-diagnostic.json';

  const report = {
    timestamp: new Date().toISOString(),
    problem,
    action,
    escalatedBy: 'CoordinatorWorkflow',
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`📊 Diagnostic report written: ${reportPath}`);
}

// Execute agent task (PoC stub)
export async function executeAgentTask(
  agent: string,
  taskType: string,
  instructions: string,
  packagePath: string
): Promise<AgentExecutionResult> {
  console.log(`[AgentExecution] Agent: ${agent}`);
  console.log(`[AgentExecution] Task: ${taskType}`);
  console.log(`[AgentExecution] Instructions: ${instructions.substring(0, 200)}...`);
  console.log(`[AgentExecution] Package Path: ${packagePath}`);

  // Validate ANTHROPIC_API_KEY
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required for agent execution'
    );
  }

  // Import tools modules
  const { getAllTools, executeTool } = await import('./tools/registry.js');
  const { validateChanges, summarizeChanges } = await import('./tools/validation.js');

  // Import types
  type ToolContext = import('./tools/registry.js').ToolContext;
  type FileChange = import('./tools/registry.js').FileChange;

  // Create tool context for tracking changes
  const toolContext: ToolContext = {
    workingDirectory: packagePath,
    changes: []
  };

  try {
    // Call Anthropic API with tool use capability
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const systemPrompt = `You are ${agent}, an autonomous development agent.

Your task: ${taskType}

Working directory: ${packagePath}

You have access to file system tools to read and write files. Use these tools to complete your task.
After you've made all necessary changes, provide a summary of what you did.`;

    const tools = getAllTools();
    const messages: Anthropic.MessageParam[] = [{
      role: 'user',
      content: instructions
    }];

    let continueLoop = true;
    let iterationCount = 0;
    const maxIterations = 20; // Prevent infinite loops

    while (continueLoop && iterationCount < maxIterations) {
      iterationCount++;

      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
        max_tokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '8192'),
        temperature: 0.2,
        system: systemPrompt,
        messages,
        tools
      });

      console.log(`[AgentExecution] Iteration ${iterationCount}, stop_reason: ${response.stop_reason}`);

      // Add assistant's response to conversation
      messages.push({
        role: 'assistant',
        content: response.content
      });

      if (response.stop_reason === 'tool_use') {
        // Execute tools
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            console.log(`[AgentExecution] Executing tool: ${block.name}`);

            const result = await executeTool(
              block.name,
              block.input as Record<string, unknown>,
              toolContext
            );

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result.success
                ? (result.output || 'Success')
                : `Error: ${result.error}`
            });
          }
        }

        // Add tool results to conversation
        messages.push({
          role: 'user',
          content: toolResults
        });

      } else {
        // Agent is done
        continueLoop = false;
      }
    }

    if (iterationCount >= maxIterations) {
      console.warn(`[AgentExecution] Reached maximum iterations (${maxIterations})`);
    }

    // Extract final text output
    const lastMessage = messages[messages.length - 1];
    let output = '';
    if (lastMessage.role === 'assistant') {
      for (const block of lastMessage.content as Anthropic.ContentBlock[]) {
        if (block.type === 'text') {
          output += block.text + '\n';
        }
      }
    }

    console.log(`[AgentExecution] Agent completed with ${toolContext.changes.length} change(s)`);

    // Validate all changes
    const validation = await validateChanges(toolContext.changes, packagePath);

    if (!validation.valid) {
      console.error(`[AgentExecution] Validation failed:`, validation.errors);
      return {
        success: false,
        changes: toolContext.changes.map((c: FileChange) => `${c.operation}: ${c.path}`),
        output: `Validation failed:\n${validation.errors.join('\n')}\n\n${output}`
      };
    }

    if (validation.warnings.length > 0) {
      console.warn(`[AgentExecution] Validation warnings:`, validation.warnings);
    }

    // Generate summary
    const changeSummary = summarizeChanges(toolContext.changes);
    console.log(`[AgentExecution] Changes:\n${changeSummary}`);

    return {
      success: true,
      changes: toolContext.changes.map((c: FileChange) => `${c.operation}: ${c.path}`),
      output: `${changeSummary}\n\n${output}`
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[AgentExecution] Failed:`, errorMsg);

    return {
      success: false,
      changes: toolContext.changes.map((c: FileChange) => `${c.operation}: ${c.path}`),
      output: `Agent execution failed: ${errorMsg}`
    };
  }
}

/**
 * Build Activities - Implemented directly
 */

export async function runBuild(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<BuildResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  try {
    const { stdout, stderr } = await execPromise('yarn build', { cwd: fullPath });

    return {
      success: true,
      duration: Date.now() - startTime,
      stdout,
      stderr
    };
  } catch (error: any) {
    return {
      success: false,
      duration: Date.now() - startTime,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message
    };
  }
}

export async function runTests(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<TestResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  try {
    const { stdout, stderr } = await execPromise(
      'yarn test --run --coverage',
      { cwd: fullPath }
    );

    // Parse coverage from output (simple regex for "Coverage: XX%")
    const coverageMatch = stdout.match(/Coverage:\s*(\d+)%/);
    const coverage = coverageMatch ? parseInt(coverageMatch[1], 10) : 0;

    return {
      success: true,
      duration: Date.now() - startTime,
      coverage,
      stdout,
      stderr
    };
  } catch (error: any) {
    return {
      success: false,
      duration: Date.now() - startTime,
      coverage: 0,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message
    };
  }
}

export async function runQualityChecks(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<QualityResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  try {
    const { stdout } = await execPromise(
      './manager validate-requirements',
      { cwd: fullPath }
    );

    return {
      passed: true,
      duration: Date.now() - startTime,
      failures: [],
      stdout
    };
  } catch (error: any) {
    const stdout = error.stdout || '';
    const failures = parseQualityFailures(stdout);

    return {
      passed: false,
      duration: Date.now() - startTime,
      failures,
      stdout
    };
  }
}

function parseQualityFailures(output: string): QualityFailure[] {
  const failures: QualityFailure[] = [];

  // Parse format: "LINT ERROR: file.ts:line - message"
  const lintRegex = /LINT ERROR:\s*([^:]+):(\d+)\s*-\s*(.+)/g;
  let match;

  while ((match = lintRegex.exec(output)) !== null) {
    failures.push({
      type: 'lint',
      file: match[1],
      line: parseInt(match[2], 10),
      message: match[3]
    });
  }

  // Parse test failures
  if (output.includes('TEST FAILED')) {
    failures.push({
      type: 'test',
      message: 'Test suite failed'
    });
  }

  return failures;
}

export async function publishPackage(input: {
  packageName: string;
  packagePath: string;
  config: BuildConfig;
}): Promise<PublishResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.config.workspaceRoot, input.packagePath);

  const env = {
    ...process.env,
    NPM_TOKEN: input.config.npmToken
  };

  try {
    const { stdout } = await execPromise(
      'npm publish --access restricted',
      { cwd: fullPath, env }
    );

    return {
      success: true,
      duration: Date.now() - startTime,
      stdout
    };
  } catch (error: any) {
    return {
      success: false,
      duration: Date.now() - startTime,
      stdout: error.stdout || error.message
    };
  }
}

export interface GitCommitInput {
  workspaceRoot: string;
  packagePath: string;
  message: string;
  gitUser?: {
    name: string;
    email: string;
  };
}

export interface GitCommitResult {
  success: boolean;
  duration: number;
  commitHash?: string;
  stdout: string;
  stderr?: string;
}

export async function commitChanges(input: GitCommitInput): Promise<GitCommitResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  try {
    // Configure git user if provided
    if (input.gitUser) {
      await execPromise(
        `git config user.name "${input.gitUser.name}"`,
        { cwd: fullPath }
      );
      await execPromise(
        `git config user.email "${input.gitUser.email}"`,
        { cwd: fullPath }
      );
    }

    // Stage all changes
    await execPromise('git add -A', { cwd: fullPath });

    // Check if there are changes to commit
    const { stdout: statusOut } = await execPromise(
      'git status --porcelain',
      { cwd: fullPath }
    );

    if (!statusOut.trim()) {
      return {
        success: true,
        duration: Date.now() - startTime,
        stdout: 'No changes to commit'
      };
    }

    // Commit with message
    const { stdout } = await execPromise(
      `git commit -m "${input.message.replace(/"/g, '\\"')}"`,
      { cwd: fullPath }
    );

    // Get commit hash
    const { stdout: hashOut } = await execPromise(
      'git rev-parse HEAD',
      { cwd: fullPath }
    );

    return {
      success: true,
      duration: Date.now() - startTime,
      commitHash: hashOut.trim(),
      stdout
    };
  } catch (error: any) {
    return {
      success: false,
      duration: Date.now() - startTime,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message
    };
  }
}

export interface GitPushInput {
  workspaceRoot: string;
  packagePath: string;
  remote?: string;
  branch?: string;
  force?: boolean;
}

export interface GitPushResult {
  success: boolean;
  duration: number;
  stdout: string;
  stderr?: string;
}

export async function pushChanges(input: GitPushInput): Promise<GitPushResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  const remote = input.remote || 'origin';
  const branch = input.branch || 'main';
  const forceFlag = input.force ? '--force' : '';

  try {
    // Check if we have commits to push
    const { stdout: statusOut } = await execPromise(
      `git status -sb`,
      { cwd: fullPath }
    );

    console.log(`[GitPush] Status: ${statusOut.trim()}`);

    // Push to remote
    const { stdout, stderr } = await execPromise(
      `git push ${forceFlag} ${remote} ${branch}`.trim(),
      { cwd: fullPath }
    );

    return {
      success: true,
      duration: Date.now() - startTime,
      stdout,
      stderr
    };
  } catch (error: any) {
    return {
      success: false,
      duration: Date.now() - startTime,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message
    };
  }
}

export async function buildDependencyGraph(auditReportPath: string): Promise<PackageNode[]> {
  // Read audit report
  const content = await fs.readFile(auditReportPath, 'utf-8');
  const report = JSON.parse(content);

  // Extract package dependencies
  const dependencies = report.checks?.packageDependencies || [];

  // For now, create simple graph from single package
  // TODO: Recursively resolve all dependencies
  const packages: PackageNode[] = [];

  // Determine category from package name
  const getCategory = (name: string): PackageCategory => {
    // Check suite first as it's the most specific (packages can have 'ui' or 'service' in 'suite' name)
    if (name.includes('suite')) return 'suite';
    if (name.includes('validator')) return 'validator';
    if (name.includes('core')) return 'core';
    if (name.includes('util')) return 'utility';
    if (name.includes('service')) return 'service';
    if (name.includes('ui')) return 'ui';
    return 'suite';
  };

  // Add dependencies as nodes
  dependencies.forEach((dep: string) => {
    const category = getCategory(dep);
    const layer = categoryToLayer(category);

    packages.push({
      name: dep,
      category,
      dependencies: [],
      layer,
      buildStatus: 'pending'
    });
  });

  // Add main package
  const mainCategory = getCategory(report.packageName);
  packages.push({
    name: report.packageName,
    category: mainCategory,
    dependencies,
    layer: categoryToLayer(mainCategory),
    buildStatus: 'pending'
  });

  // Sort by layer (validators first, suites last)
  return packages.sort((a, b) => a.layer - b.layer);
}

function categoryToLayer(category: PackageCategory): number {
  const layerMap: Record<PackageCategory, number> = {
    'validator': 0,
    'core': 1,
    'utility': 2,
    'service': 3,
    'ui': 4,
    'suite': 5
  };
  return layerMap[category];
}

/**
 * Agent Activities - Implemented directly
 */

export async function verifyDependencies(dependencies: string[]): Promise<void> {
  // In production, this would check npm registry or local registry
  // For now, we'll just validate the list isn't empty
  if (dependencies.length > 0) {
    console.log(`Verifying ${dependencies.length} dependencies...`);
  }

  // TODO: Add actual npm registry checks
  // for (const dep of dependencies) {
  //   const exists = await checkNpmPackage(dep);
  //   if (!exists) {
  //     throw new Error(`Dependency not published: ${dep}`);
  //   }
  // }
}

export async function spawnFixAgent(input: {
  packagePath: string;
  planPath: string;
  failures: QualityFailure[];
}): Promise<void> {
  // Categorize failures
  const failureTypes = [...new Set(input.failures.map(f => f.type))];

  // Format failures for prompt
  const formattedFailures = input.failures
    .map(f => {
      if (f.file && f.line) {
        return `- ${f.type.toUpperCase()}: ${f.file}:${f.line} - ${f.message}`;
      }
      return `- ${f.type.toUpperCase()}: ${f.message}`;
    })
    .join('\n');

  // In a real implementation, this would use the Task tool
  // For now, we'll simulate by logging what would be sent
  console.log('Would spawn agent with prompt:');
  console.log(`Package: ${input.packagePath}`);
  console.log(`Plan: ${input.planPath}`);
  console.log(`Failures:\n${formattedFailures}`);
  console.log(`Failure types: ${failureTypes.join(', ')}`);

  // TODO: Integrate with actual agent spawning mechanism
}

/**
 * Report Activities - Implemented directly
 */

export async function writePackageBuildReport(
  report: PackageBuildReport,
  workspaceRoot: string
): Promise<void> {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const reportDir = path.join(workspaceRoot, 'production', 'reports', date);
  const sanitizedName = report.packageName.replace(/@/g, '').replace(/\//g, '-');
  const reportPath = path.join(reportDir, `${sanitizedName}.json`);

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`📊 Report written: ${reportPath}`);
}
