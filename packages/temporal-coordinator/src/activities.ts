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
import Anthropic from '@anthropic-ai/sdk';
import Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Strip markdown code blocks from text
 * Handles both ```json ... ``` and ``` ... ``` formats
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

  let customAgents: AgentRegistryEntry[] = [];

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
  const { getAllTools, executeTool, ToolContext, FileChange } = await import('./tools/registry.js');
  const { validateChanges, summarizeChanges } = await import('./tools/validation.js');

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
        changes: toolContext.changes.map(c => `${c.operation}: ${c.path}`),
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
      changes: toolContext.changes.map(c => `${c.operation}: ${c.path}`),
      output: `${changeSummary}\n\n${output}`
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[AgentExecution] Failed:`, errorMsg);

    return {
      success: false,
      changes: toolContext.changes.map(c => `${c.operation}: ${c.path}`),
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
    const { stdout, stderr } = await execAsync('yarn build', { cwd: fullPath });

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
    const { stdout, stderr } = await execAsync(
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
    const { stdout } = await execAsync(
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
    const { stdout } = await execAsync(
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
      await execAsync(
        `git config user.name "${input.gitUser.name}"`,
        { cwd: fullPath }
      );
      await execAsync(
        `git config user.email "${input.gitUser.email}"`,
        { cwd: fullPath }
      );
    }

    // Stage all changes
    await execAsync('git add -A', { cwd: fullPath });

    // Check if there are changes to commit
    const { stdout: statusOut } = await execAsync(
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
    const { stdout } = await execAsync(
      `git commit -m "${input.message.replace(/"/g, '\\"')}"`,
      { cwd: fullPath }
    );

    // Get commit hash
    const { stdout: hashOut } = await execAsync(
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
    const { stdout: statusOut } = await execAsync(
      `git status -sb`,
      { cwd: fullPath }
    );

    console.log(`[GitPush] Status: ${statusOut.trim()}`);

    // Push to remote
    const { stdout, stderr } = await execAsync(
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
