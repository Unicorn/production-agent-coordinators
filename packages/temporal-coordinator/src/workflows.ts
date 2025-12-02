/**
 * Temporal Workflows for Agent Coordinator
 *
 * Workflows define the orchestration logic and must be deterministic.
 * They call activities to perform actual work.
 *
 * IMPORTANT: Workflows must be deterministic - no direct I/O, no Date.now(),
 * no Math.random(). Use activities for all non-deterministic operations.
 */

import { proxyActivities, ApplicationFailure, workflowInfo } from '@temporalio/workflow';
import type * as activities from './activities';
import type { EngineState, AgentResponse } from '@coordinator/contracts';

// Create activity proxies with timeouts and retry policies
const {
  initializeWorkflow,
  executeSpecDecision,
  executeAgentStep,
  processAgentResponse,
  storeArtifact,
  setupWorkspace,        // New activity
  executeGeminiAgent,    // New activity
  runComplianceChecks,   // New activity
  logAuditEntry,         // New activity
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes', // Increased timeout for agent activities
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '60s', // Increased maximum interval
    maximumAttempts: 1,     // Workflow will handle retries explicitly
  },
});

/**
 * Configuration for hello workflow
 */
export interface HelloWorkflowConfig {
  goalId: string;
  specType: string;
  specConfig?: {
    workKind?: string;
    [key: string]: unknown;
  };
  agentType: string;
  agentConfig?: Record<string, unknown>;
  agentApiKey?: string;
  maxIterations?: number;
}

/**
 * Simple hello world workflow using HelloSpec
 *
 * This workflow demonstrates the integration of:
 * - Temporal durability and retries
 * - Agent Coordinator's Engine for state management
 * - HelloSpec for workflow logic
 * - MockAgent (or other agents) for execution
 */
export async function helloWorkflow(
  config: HelloWorkflowConfig
): Promise<EngineState> {
  const {
    goalId,
    specType,
    specConfig,
    agentType,
    agentConfig,
    agentApiKey,
    maxIterations = 10,
  } = config;

  console.log(`[Workflow] Starting hello workflow for goal: ${goalId}`);

  // Step 1: Initialize workflow state
  let state = await initializeWorkflow(goalId, {
    specType,
    specConfig: specConfig || {},
    agentType,
    agentConfig: agentConfig || {},
  });

  console.log(`[Workflow] Initial state created, status: ${state.status}`);

  let iterations = 0;
  let lastResponse: AgentResponse | undefined;

  // Step 2: Execute workflow loop
  while (state.status === 'RUNNING' && iterations < maxIterations) {
    console.log(`[Workflow] Iteration ${iterations + 1}/${maxIterations}`);

    // Get decision from spec and process it
    state = await executeSpecDecision(state, {
      specType,
      specConfig: specConfig || {},
      lastResponse,
    });

    console.log(`[Workflow] State after spec decision: ${state.status}`);

    // Check if we're done
    if (state.status !== 'RUNNING') {
      console.log(`[Workflow] Workflow completed with status: ${state.status}`);
      break;
    }

    // Execute any waiting steps
    const waitingSteps = Object.entries(state.openSteps).filter(
      ([_, step]) => step.status === 'WAITING'
    );

    console.log(`[Workflow] Found ${waitingSteps.length} waiting steps`);

    for (const [stepId, step] of waitingSteps) {
      console.log(`[Workflow] Executing step: ${stepId} (${step.kind})`);

      // Mark step as in progress (update state directly since this is deterministic)
      state = {
        ...state,
        openSteps: {
          ...state.openSteps,
          [stepId]: {
            ...step,
            status: 'IN_PROGRESS',
            updatedAt: Date.now(), // Temporal intercepts Date.now() making it deterministic
          },
        },
      };

      // Execute agent step
      try {
        const response = await executeAgentStep(goalId, stepId, step, {
          agentType,
          agentConfig: agentConfig || {},
          agentApiKey,
        });

        console.log(`[Workflow] Step ${stepId} completed with status: ${response.status}`);

        // Process agent response
        state = await processAgentResponse(state, response);
        lastResponse = response;

        console.log(`[Workflow] State after agent response: ${state.status}`);
      } catch (error) {
        console.error(`[Workflow] Step ${stepId} failed:`, error);

        // Create error response
        const errorResponse: AgentResponse = {
          goalId,
          workflowId: 'temporal-workflow',
          stepId,
          runId: `run-${Date.now()}`,
          agentRole: 'agent',
          status: 'FAIL',
          errors: [
            {
              type: 'PROVIDER_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
              retryable: false,
            },
          ],
        };

        state = await processAgentResponse(state, errorResponse);
        throw error; // Let Temporal handle retries
      }
    }

    iterations++;
  }

  // Step 3: Store artifacts if any
  if (Object.keys(state.artifacts).length > 0) {
    console.log(`[Workflow] Storing ${Object.keys(state.artifacts).length} artifacts`);
    for (const [key, value] of Object.entries(state.artifacts)) {
      await storeArtifact(goalId, key, value);
    }
  }

  // Step 4: Return final state
  console.log(`[Workflow] Workflow complete, final status: ${state.status}`);
  return state;
}

/**
 * Multi-step workflow example (for future expansion)
 *
 * This demonstrates how to build more complex workflows with multiple specs
 * and conditional logic.
 */
export async function multiStepWorkflow(
  config: HelloWorkflowConfig
): Promise<EngineState> {
  // This is a placeholder for more complex workflow patterns
  // For now, it just delegates to helloWorkflow
  return helloWorkflow(config);
}

/**
 * Orchestrates the Gemini CLI for agent-driven package building,
 * including scaffolding, implementation, compliance checks, and an auditing/repair loop.
 */
export async function AuditedBuildWorkflow(specFileContent: string, requirementsFileContent: string): Promise<string> {
  const workflowId = workflowInfo().workflowId; // Get workflow ID for logging

  // 1. Setup Workspace
  const workingDir = await setupWorkspace('/tmp/gemini-builds');
  console.log(`[Workflow] Workspace set up at: ${workingDir}`);

  // 2. Context Injection: Combine both documents for the Agent's brain.
  const masterContext = `
# AGENT DIRECTIVE: CORE PACKAGE IMPLEMENTATION

> **ROLE**: Senior TypeScript Engineer & BernierLLC Quality Specialist.
> **OBJECTIVE**: Create the '@bernierllc/contentful-types' Core Package. Your goal is to pass all validation checks on the first attempt, achieving 90% test coverage minimum.

## 🛑 BernierLLC STRICT PUBLISHING CONSTRAINTS
${requirementsFileContent} 

---

## 📦 PACKAGE SPECIFICATION (Input)
${specFileContent}

---

## 🛡️ VERIFICATION PROTOCOL
The code you write will immediately be tested against:
* \`npm install\`
* \`npm run build\` (Must succeed and generate \`.d.ts\` files)
* \`npm run lint\` (Must pass with zero issues)
* \`npm test\` (Must pass and meet 90% coverage)

If you fail these, you fail the job.
`;

  // Initial log entry for workflow start
  await logAuditEntry(workingDir, {
    workflow_run_id: workflowId,
    step_name: 'workflow_start',
    context_file_hash: 'TODO: Calculate hash of masterContext', // TODO: Implement SHA-256 hash
    validation_status: 'N/A',
  });
  
  // 3. Scaffolding Phase
  await executeGeminiAgent({
    workingDir,
    contextContent: masterContext,
    instruction: `
      Read the BernierLLC requirements. Create all configuration files (package.json, tsconfig.json, jest.config.js, .eslintrc.js) and the README.md structure.
      Ensure package.json includes scripts for build, test, and lint as per requirements.
    `
  });
  await logAuditEntry(workingDir, {
    workflow_run_id: workflowId,
    step_name: 'scaffolding_complete',
    validation_status: 'N/A',
  });
  
  // 4. Implementation Phase
  await executeGeminiAgent({
    workingDir,
    contextContent: masterContext, // Re-use the master context
    instruction: `
      Read the 'PACKAGE SPEC' section in GEMINI.md. Generate all source code files and initial tests, ensuring 90% coverage and full compliance with all BernierLLC constraints.
    `
  });
  await logAuditEntry(workingDir, {
    workflow_run_id: workflowId,
    step_name: 'implementation_complete',
    validation_status: 'N/A',
  });

  // 5. The Audited Verification Loop
  let attempts = 0;
  const MAX_REPAIR_ATTEMPTS = 3;
  let isGreen = false;

  while (attempts < MAX_REPAIR_ATTEMPTS && !isGreen) {
    attempts++;
    console.log(`[Workflow] Running compliance checks, Attempt ${attempts}/${MAX_REPAIR_ATTEMPTS}`);
    
    // A. Run Compliance Checks
    const validation = await runComplianceChecks(workingDir);
    
    const auditEntry = {
        workflow_run_id: workflowId,
        step_name: attempts === 1 ? 'initial_verification' : `repair_attempt_${attempts}`,
        success: validation.success,
        validation_status: validation.success ? 'pass' : 'fail' as 'pass' | 'fail',
        commands_attempted: validation.commandsRun,
        error_type: validation.success ? 'N/A' : (validation.errors?.[0]?.type || 'UNKNOWN_ERROR'),
        error_full: validation.success ? null : validation.output,
        // TODO: Add token counts when executeGeminiAgent provides them
    };

    // B. Log the result
    await logAuditEntry(workingDir, auditEntry);

    if (validation.success) {
      isGreen = true;
      console.log(`[Workflow] Compliance checks passed on attempt ${attempts}.`);
      break;
    }

    // C. If Red, orchestrate the Fix
    console.log(`[Workflow] Validation failed (Attempt ${attempts}). Requesting fix...`);

    const fixPrompt = `
      The build/validation failed with the following errors. 
      Analyze the errors carefully. Fix the code files to resolve these issues.
      
      --- FAILURE LOG ---
      ${validation.output}
      -------------------
      
      Return ONLY the fixed code actions. Do not explain.
    `;

    await executeGeminiAgent({
      workingDir,
      contextContent: masterContext, // Provide full context for the agent to fix
      instruction: fixPrompt
    });
  }

  if (!isGreen) {
    throw new ApplicationFailure(`
      Failed to meet publishing requirements after ${MAX_REPAIR_ATTEMPTS} attempts.
      Manual review required. Check audit_trace.jsonl in ${workingDir} for details.
    `, 'BuildFailure', true // Non-retryable from workflow perspective
    );
  }

  console.log(`[Workflow] Core Package Verified Green at ${workingDir}. Audit trail generated.`);
  return `Core Package Verified Green in ${workingDir}. Audit trail in audit_trace.jsonl.`;
}

/**
 * Package Builder Coordinator Workflows
 * Re-export from package-builder-production agent
 */
export { PackageBuildWorkflow } from '@coordinator/agent-package-builder-production/dist/workflows/package-build.workflow.js'

/**
 * Claude CLI Workflows
 * Re-export from claude-workflows module
 */
export {
  ClaudeAuditedBuildWorkflow,
  ClaudeSimpleBuildWorkflow,
  ClaudePremiumBuildWorkflow,
} from './claude-workflows.js'
