# Plan: Enhancing Gemini-Based Package Builder Workflows with Headless CLI Orchestration

## 1. Overview

This plan outlines the strategy to enhance our Gemini-based package builder workflows by orchestrating the Gemini CLI in a headless, autonomous mode via Temporal. This approach addresses the complexities of direct API interaction, leveraging the CLI's built-in capabilities for tool execution and context management, while utilizing Temporal for durability, reliability, and complex orchestration.

The core idea is to treat the Gemini CLI as an "autonomous agent activity" within a Temporal workflow, allowing for systematic execution, verification, and self-correction.

## 2. Core Components and Activities

### 2.1 `executeGeminiAgent` Activity

This activity will serve as the primary interface to the Gemini CLI.

*   **Purpose**: To execute Gemini CLI commands in a non-interactive, stateless manner, capturing its structured JSON output.
*   **Input**:
    *   `instruction`: The prompt for Gemini (e.g., "Build the files...", "Fix the errors...").
    *   `workingDir`: The directory where the CLI command should be executed (the project's sandbox).
    *   `contextContent` (optional): Content to be written to `GEMINI.md` before execution, providing specific context for the current step.
*   **Action**:
    1.  Writes `contextContent` to `GEMINI.md` in `workingDir` if provided.
    2.  Constructs the `gemini` command using `--prompt`, `--context GEMINI.md`, `--output-format json`, and `--yolo`.
    3.  Executes the command as a child process, setting `cwd` to `workingDir`.
    4.  Parses the JSON `stdout` from the CLI.
    5.  Handles potential errors (e.g., CLI crashes, non-JSON output).
*   **Output**: Structured JSON result from the Gemini CLI or a success/failure indicator with raw output/errors.
*   **Temporal Configuration**:
    *   `startToCloseTimeout`: Configured for sufficient time (e.g., '5 minutes' to '10 minutes') to allow the agent to complete its task.
    *   `retry`: Configured with a `maximumAttempts` (e.g., 3) to handle transient CLI failures.

### 2.2 `runComplianceChecks` Activity

This activity encapsulates the project's quality gates.

*   **Purpose**: To run a series of verification commands (install, build, lint, test) against the generated code.
*   **Input**: `workingDir` (the project's sandbox).
*   **Action**:
    1.  Executes `npm install` (or `npm ci` for clean install).
    2.  Executes `npm run build`.
    3.  Executes `npm run lint`.
    4.  Executes `npm test`.
    5.  Captures `stdout` and `stderr` for each command.
    6.  Detects any non-zero exit codes as failures.
*   **Output**: A `{ success: boolean, output: string, commandsRun: string[] }` object, where `output` contains concatenated command outputs and error logs on failure.
*   **Temporal Configuration**:
    *   `startToCloseTimeout`: Configured to allow for the cumulative execution time of all checks.

### 2.3 `setupWorkspace` Activity

*   **Purpose**: To create a clean, temporary directory for each package build.
*   **Input**: `basePath` (e.g., `/tmp/gemini-builds`).
*   **Output**: Path to the newly created working directory.

## 3. Workflow Orchestration: `AuditedBuildWorkflow`

This workflow will manage the end-to-end package generation and verification process.

### 3.1 Workflow Signature

`AuditedBuildWorkflow(specFileContent: string, requirementsFileContent: string): Promise<string>`

*   `specFileContent`: The specific package specification (e.g., `contentful-types.md`).
*   `requirementsFileContent`: The BernierLLC Package Minimum Requirements (e.g., `PACKAGE_REQUIREMENTS.md`).

### 3.2 Phases of the Workflow

#### Phase 1: Context and Scaffold (The First Pass)

1.  **Setup Workspace**: Calls `setupWorkspace` to create a dedicated working directory.
2.  **Context Injection**: Combines `specFileContent` and `requirementsFileContent` into a single `masterContext` string, formatted with strict constraints and input specification sections. This `masterContext` will be written to `GEMINI.md`.
3.  **Scaffolding**: Calls `executeGeminiAgent` with an instruction to create configuration files (`package.json`, `tsconfig.json`, `jest.config.js`, `.eslintrc.js`) and `README.md` based on the BernierLLC requirements. `masterContext` is provided as `contextContent`.
4.  **Implementation**: Calls `executeGeminiAgent` again with an instruction to generate source code files and initial tests, adhering to the package specification and compliance constraints. `masterContext` is re-used as `contextContent`.

#### Phase 2: The Audited Verification Loop (Greenlight Check)

This loop aims to achieve a "Green Build" state by iteratively running compliance checks and requesting fixes from Gemini.

1.  **Loop Initialization**: `attempts = 0`, `MAX_REPAIR_ATTEMPTS = 3`, `isGreen = false`.
2.  **Run Compliance Checks**: Inside the loop, calls `runComplianceChecks`.
3.  **Audit Logging**: Calls `logAuditEntry` (from the optimization plan) to record the outcome of the `runComplianceChecks` activity, including success status, commands run, and error details.
4.  **Decision**:
    *   If `runComplianceChecks` returns `success: true`, sets `isGreen = true` and breaks the loop.
    *   If `runComplianceChecks` returns `success: false` and `attempts < MAX_REPAIR_ATTEMPTS`:
        *   Constructs a targeted `fixPrompt` containing the `validation.output` (error log).
        *   Calls `executeGeminiAgent` with the `fixPrompt` to instruct Gemini to resolve the issues.
        *   Increments `attempts` and continues the loop.
5.  **Failure Handling**: If the loop completes and `isGreen` is still `false`, throws an `ApplicationFailure` indicating that the build could not be stabilized, recommending manual review.
6.  **Success Return**: If `isGreen` is `true`, returns a success message including the working directory path.

## 4. Key Design Principles

*   **Durability**: Temporal ensures the workflow resumes from the last completed activity, even in case of worker crashes.
*   **Token Efficiency**:
    *   `GEMINI.md` acts as a condensed, step-specific context, avoiding redundant context transfer.
    *   Fix prompts are highly targeted, feeding only relevant error logs to minimize input tokens for rework.
*   **Constraint-Driven Development**: Embedding BernierLLC requirements directly into `GEMINI.md` forces Gemini to produce higher quality code upfront, reducing rework.
*   **Auditable Process**: Integration with `audit_trace.jsonl` provides a detailed log of every step, outcome, and token cost for continuous optimization.

## 5. Next Steps / Implementation Tasks

1.  **Define `PACKAGE_REQUIREMENTS.md`**: Create or refine the document containing BernierLLC's minimum package requirements (linting rules, test coverage, documentation standards, etc.).
2.  **Implement `executeGeminiAgent` Activity**: Create the TypeScript implementation for this activity, including robust error handling and JSON parsing.
3.  **Implement `runComplianceChecks` Activity**: Implement this activity to run the specified `npm` commands and capture their output.
4.  **Implement `logAuditEntry` Activity**: (Covered in the optimization plan)
5.  **Implement `AuditedBuildWorkflow`**: Write the Temporal workflow logic, integrating the activities as described above.
6.  **Testing**: Develop comprehensive unit and integration tests for all activities and the workflow.
7.  **Environment Setup**: Ensure the Temporal worker environment has the Gemini CLI installed and configured for `--yolo` mode and authentication.
8.  **Tooling Integration**: Consider adding a local script to simulate the workflow execution for faster development cycles.

This plan provides a solid foundation for building a robust and efficient Gemini-powered package builder. The iterative nature of the verification loop, combined with detailed auditing, will allow for continuous improvement and optimization of the code generation process.