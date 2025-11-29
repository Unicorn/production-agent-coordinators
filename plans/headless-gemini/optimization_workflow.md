# Plan: Optimization Workflow for Gemini-Based Code Generation

## 1. Overview

This plan establishes a methodology for systematically optimizing the token usage, efficiency, and quality of our Gemini-based code generation workflows. By formalizing data collection, auditing interactions, and analyzing performance metrics, we aim to reduce rework, improve first-pass success rates, and minimize operational costs. This "Optimization Workflow" will run periodically to analyze the data collected by the `AuditedBuildWorkflow`.

## 2. The Core Data Model: `OptimizationLogEntry`

To facilitate effective analysis, each interaction with the Gemini agent (via `executeGeminiAgent` or `runComplianceChecks`) and critical workflow events will be logged as a `OptimizationLogEntry` to an `audit_trace.jsonl` file within the working directory.

```typescript
interface OptimizationLogEntry {
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
  rework_cost_factor?: number;      // completion_token_count / error_log_size_chars (Efficiency metric).
  files_touched?: string[];         // List of files created/modified by the agent in this step.
  error_full?: string;              // Full error log (truncated if very large for storage).
  commands_attempted?: string[];    // Commands run during validation for this step.
}
```

## 3. Data Capture: `logAuditEntry` Activity

A dedicated Temporal Activity, `logAuditEntry`, will be responsible for writing `OptimizationLogEntry` records to the `audit_trace.jsonl` file.

```typescript
// activities.ts
import * as fs from 'fs/promises';
import * as path from 'path';

export async function logAuditEntry(workingDir: string, entry: Partial<OptimizationLogEntry>) {
  const logPath = path.join(workingDir, 'audit_trace.jsonl');
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
  await fs.appendFile(logPath, line);
}
```

This activity will be called at strategic points within the `AuditedBuildWorkflow`:
*   After each `executeGeminiAgent` call (to log token counts, context hash, files touched).
*   After each `runComplianceChecks` call (to log validation status, error types, error log size).

## 4. Optimization Workflow Methodology (Analysis Phase)

Once sufficient data (e.g., dozens of `audit_trace.jsonl` files) has been accumulated, a separate, independent workflow or script will analyze these logs to derive actionable insights.

### Phase 1: Data Aggregation and Normalization

1.  **Collect Logs**: Gather all `audit_trace.jsonl` files from completed workflow runs.
2.  **Parse and Aggregate**: Read each `.jsonl` file, parse its entries, and combine them into a central dataset.
3.  **Calculate Metrics**: Compute derived metrics (e.g., `total_token_cost`, `rework_cost_factor`) if not already present in the logs.

### Phase 2: Audits and Actionable Insights

#### 4.1 Token Efficiency Audit

*   **Goal**: Identify the most token-expensive steps and failures, aiming to reduce the `total_token_cost` per successful build.
*   **Query Example**:
    *   Group logs by `validation_error_type` for `fix_attempt_X` steps and calculate the average `total_token_cost`.
    *   Analyze `prompt_token_count` of `executeGeminiAgent` calls, especially the ratio of `GEMINI.md` content to the specific `instruction` string.
*   **Actionable Insight Example**: If `ESLINT_ERROR_NO_ANY` is the most expensive error to fix, it indicates the agent is spending significant tokens to add types during rework.
*   **Optimization**: Rework the `STRICT CONSTRAINTS` section in the `GEMINI.md` template (e.g., "All function parameters and return types must be explicitly defined, avoiding `any` except in specific, justified cases. Use `unknown` or generics where type inference is insufficient.").

#### 4.2 Constraint Effectiveness Audit

*   **Goal**: Validate that the strict requirements embedded in `GEMINI.md` are effectively preventing specific types of errors.
*   **Query Example**:
    *   Calculate the frequency of each `validation_error_type` across all builds.
    *   Compare error frequencies before and after updates to `GEMINI.md` constraints.
*   **Actionable Insight Example**: If `JEST_FAILURE` is common despite strong TypeScript compliance, it suggests issues with the agent's test-writing capabilities or instructions.
*   **Optimization**: Update the `Implementation Prompt` or `VERIFICATION PROTOCOL` in `GEMINI.md` to provide more explicit guidance on test structure, coverage expectations, or mocking strategies.

#### 4.3 Prompt Refinement Audit

*   **Goal**: Determine if specific phrasing in prompts leads to better first-pass success rates or lower rework costs.
*   **Query Example**:
    *   Compare `completion_token_count` and `validation_status` for `implement_v1` steps associated with different versions of the `instruction` text.
    *   Analyze `rework_cost_factor` for `fix_attempt_X` steps, correlating with the specific `fixPrompt` used.
*   **Actionable Insight Example**: Discover that prompts explicitly stating "Return ONLY the fixed code actions. Do not explain." result in a lower `completion_token_count` for fixes.
*   **Optimization**: Refine prompt templates for conciseness, clarity, and directive language to guide the agent towards efficient and high-quality outputs. Regularly A/B test prompt variations if feasible.

#### 4.4 Context Volatility Audit

*   **Goal**: Understand how changes to the `GEMINI.md` context influence agent behavior and costs.
*   **Query Example**: Analyze `context_file_hash` changes and correlate them with changes in `validation_status` or `total_token_cost`.
*   **Actionable Insight Example**: A specific update to the `Core Package Specifics` section in `GEMINI.md` led to a significant reduction in `TSC_ERROR` related to `.d.ts` generation.
*   **Optimization**: Ensure only necessary and stable information is included in the base `GEMINI.md` context, allowing dynamic injection for step-specific details.

## 5. Implementation Tasks

1.  **Implement `logAuditEntry` Activity**: Create the TypeScript implementation for this activity.
2.  **Integrate `logAuditEntry`**: Add calls to `logAuditEntry` at appropriate points within `AuditedBuildWorkflow` to capture the defined `OptimizationLogEntry` fields.
3.  **Develop Analysis Script/Workflow**: Create a separate script or Temporal workflow that can:
    *   Retrieve `audit_trace.jsonl` files (e.g., from a shared storage or by querying Temporal history).
    *   Parse and aggregate the log data.
    *   Execute the described audit queries.
    *   Generate reports or visualizations to present the actionable insights.
4.  **Define Token Estimation**: Research and implement a robust method for estimating `prompt_token_count` and `completion_token_count` (e.g., using an LLM tokenizer library, or relying on `gemini` CLI's eventual output if it provides token counts).
5.  **Scheduled Execution**: Schedule the analysis script/workflow to run periodically (e.g., daily or weekly) to provide continuous feedback on system performance.

By rigorously implementing this optimization workflow, we can transform our code generation process into a data-driven, continuously improving system.
