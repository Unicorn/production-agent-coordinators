# Deterministic CLI Activities Pattern

## Problem

Temporal workflows must be deterministic - they can't depend on non-deterministic values like:
- Actual CLI conversation content
- Random timestamps
- Non-deterministic API responses

However, we want:
- Real, interactive CLI calls (not mocked)
- Visibility into each CLI interaction in Temporal UI
- Ability to debug by reading actual CLI output

## Solution: File-Based Deterministic Results

Each CLI activity should:
1. **Execute the real CLI** (interactive, non-deterministic)
2. **Write results to a log file** (deterministic file path)
3. **Return only deterministic values**:
   - Log file path (deterministic - based on workflow ID, activity name, sequence)
   - Session ID (deterministic - for Claude session continuity)
   - Success/failure status (deterministic)
   - Cost, duration (deterministic metadata)

## Implementation Pattern

### Activity Returns Deterministic Result

```typescript
interface DeterministicCLIResult {
  // Deterministic values only
  success: boolean;
  logFilePath: string;  // ← Deterministic file path
  sessionId?: string;    // ← Deterministic session ID (for Claude)
  cost_usd: number;
  duration_ms: number;
  provider: CLIProviderName;
  error?: string;        // Error message (deterministic string)
  
  // Optional: For quick access without reading file
  summary?: string;       // Brief summary (deterministic)
}
```

### Activity Implementation

```typescript
export async function executeClaudeCLI(params: {
  instruction: string;
  workingDir: string;
  sessionId?: string;
  model: ClaudeModel;
  permissionMode: 'plan' | 'acceptEdits' | 'full';
  workflowId: string;     // ← For deterministic log path
  activityName: string;   // ← For deterministic log path
  sequenceNumber: number; // ← For deterministic log path
}): Promise<DeterministicCLIResult> {
  
  // Generate deterministic log file path
  const logFileName = `${params.workflowId}-${params.activityName}-${params.sequenceNumber}.jsonl`;
  const logFilePath = path.join(params.workingDir, '.claude', 'logs', logFileName);
  
  // Ensure log directory exists
  await fs.mkdir(path.dirname(logFilePath), { recursive: true });
  
  // Execute real CLI (interactive, non-deterministic)
  const cliResult = await executeClaudeAgent({
    instruction: params.instruction,
    workingDir: params.workingDir,
    sessionId: params.sessionId,
    model: params.model,
    permissionMode: params.permissionMode,
  });
  
  // Write full conversation to log file (non-deterministic content, deterministic path)
  const logEntry = {
    timestamp: new Date().toISOString(),
    workflowId: params.workflowId,
    activityName: params.activityName,
    sequenceNumber: params.sequenceNumber,
    instruction: params.instruction,
    sessionId: cliResult.session_id,
    result: cliResult.result,
    cost_usd: cliResult.cost_usd,
    duration_ms: cliResult.duration_ms,
    success: cliResult.success,
    error: cliResult.error,
    raw_output: cliResult.raw_output,
  };
  
  await fs.writeFile(logFilePath, JSON.stringify(logEntry, null, 2), 'utf-8');
  
  // Return only deterministic values
  return {
    success: cliResult.success,
    logFilePath,  // ← Deterministic path
    sessionId: cliResult.session_id,  // ← Deterministic session ID
    cost_usd: cliResult.cost_usd,
    duration_ms: cliResult.duration_ms,
    provider: 'claude',
    error: cliResult.error,
    summary: cliResult.success 
      ? `CLI execution completed successfully (${cliResult.result.length} chars)`
      : `CLI execution failed: ${cliResult.error}`,
  };
}
```

### Workflow Uses Deterministic Results

```typescript
export async function PackageBuildWorkflow(input: PackageBuildInput): Promise<PackageBuildResult> {
  const workflowId = workflowInfo().workflowId;
  let sequenceNumber = 0;
  
  // Each CLI call is a separate activity (visible in Temporal UI)
  const task1Result = await executeClaudeCLI({
    instruction: task1Instruction,
    workingDir: packageFullPath,
    workflowId,
    activityName: 'scaffold-task-1',
    sequenceNumber: sequenceNumber++,
  });
  
  // Workflow only depends on deterministic values
  if (!task1Result.success) {
    throw new Error(`Task 1 failed - see log: ${task1Result.logFilePath}`);
  }
  
  // Pass session ID to next activity (deterministic)
  const task2Result = await executeClaudeCLI({
    instruction: task2Instruction,
    workingDir: packageFullPath,
    sessionId: task1Result.sessionId,  // ← Deterministic session ID
    workflowId,
    activityName: 'scaffold-task-2',
    sequenceNumber: sequenceNumber++,
  });
  
  // If workflow needs to read actual CLI output, it can do so in a separate activity
  if (needToReadOutput) {
    const output = await readCLILogFile({
      logFilePath: task1Result.logFilePath,  // ← Deterministic path
    });
    // Use output for decision making
  }
}
```

## Benefits

1. **Deterministic Workflows**: Workflow only depends on file paths, session IDs, and status - all deterministic
2. **Full Visibility**: Each CLI call appears as separate activity in Temporal UI
3. **Debuggable**: Can read actual CLI logs from deterministic file paths
4. **Interactive CLI**: Real CLI calls still happen (non-deterministic execution, deterministic results)
5. **Session Continuity**: Session IDs passed between activities (deterministic)

## File Path Generation

Log file paths should be deterministic based on:
- Workflow ID (from `workflowInfo().workflowId`)
- Activity name (deterministic string)
- Sequence number (deterministic counter)

Example:
```
.claude/logs/
  wf-abc123-scaffold-task-1-0.jsonl
  wf-abc123-scaffold-task-2-1.jsonl
  wf-abc123-implement-task-1-2.jsonl
```

## Reading Log Files (If Needed)

If the workflow needs to read CLI output for decision making:

```typescript
export async function readCLILogFile(params: {
  logFilePath: string;  // ← Deterministic path from previous activity
}): Promise<{ result: string; cost_usd: number; duration_ms: number }> {
  const logContent = await fs.readFile(params.logFilePath, 'utf-8');
  const logEntry = JSON.parse(logContent);
  return {
    result: logEntry.result,
    cost_usd: logEntry.cost_usd,
    duration_ms: logEntry.duration_ms,
  };
}
```

## Migration Strategy

1. **Phase 1**: Update activity return types to include `logFilePath`
2. **Phase 2**: Write logs in activities, return file paths
3. **Phase 3**: Update workflows to use file paths instead of direct results
4. **Phase 4**: Remove `result` field from activity returns (or make it optional summary)

## Example: Task Breakdown Activity

```typescript
export async function requestTaskBreakdown(params: {
  planContent: string;
  requirementsContent: string;
  phase: 'scaffold' | 'implement';
  workingDir: string;
  provider: CLIProviderName;
  workflowId: string;
  sequenceNumber: number;
}): Promise<{
  success: boolean;
  logFilePath: string;  // ← Deterministic
  taskBreakdownFilePath?: string;  // ← Path to parsed JSON (deterministic)
  sessionId?: string;  // ← For Claude (deterministic)
  error?: string;
}> {
  
  // Execute CLI (interactive)
  const cliResult = await executeClaudeCLI({
    instruction: breakdownPrompt,
    workingDir: params.workingDir,
    workflowId: params.workflowId,
    activityName: `task-breakdown-${params.phase}`,
    sequenceNumber: params.sequenceNumber,
  });
  
  if (!cliResult.success) {
    return {
      success: false,
      logFilePath: cliResult.logFilePath,
      error: cliResult.error,
    };
  }
  
  // Parse JSON from log file (deterministic - reading from deterministic path)
  const logContent = await fs.readFile(cliResult.logFilePath, 'utf-8');
  const logEntry = JSON.parse(logContent);
  const taskBreakdown = JSON.parse(logEntry.result);  // Extract JSON from CLI response
  
  // Write parsed breakdown to separate file (deterministic path)
  const breakdownFilePath = cliResult.logFilePath.replace('.jsonl', '-breakdown.json');
  await fs.writeFile(breakdownFilePath, JSON.stringify(taskBreakdown, null, 2), 'utf-8');
  
  return {
    success: true,
    logFilePath: cliResult.logFilePath,
    taskBreakdownFilePath: breakdownFilePath,  // ← Deterministic path to parsed result
    sessionId: cliResult.sessionId,
  };
}
```

## Workflow Reads Breakdown

```typescript
// Activity returns deterministic file path
const breakdownResult = await requestTaskBreakdown({
  // ... params
  workflowId,
  sequenceNumber: sequenceNumber++,
});

if (!breakdownResult.success) {
  throw new Error(`Breakdown failed - see log: ${breakdownResult.logFilePath}`);
}

// Workflow reads from deterministic file path
const breakdownContent = await fs.readFile(breakdownResult.taskBreakdownFilePath!, 'utf-8');
const taskBreakdown = JSON.parse(breakdownContent);

// Use taskBreakdown.tasks, taskBreakdown.outline, etc.
for (const task of taskBreakdown.tasks) {
  // Execute each task...
}
```

## Key Principles

1. **Activities execute non-deterministic operations** (real CLI calls)
2. **Activities write results to files** (deterministic paths)
3. **Activities return only deterministic values** (file paths, IDs, status)
4. **Workflows depend only on deterministic values** (file paths, not content)
5. **Workflows can read files in separate activities** (if needed for decisions)

This pattern ensures:
- ✅ Workflows are deterministic (Temporal requirement)
- ✅ CLI is still interactive (real execution)
- ✅ Full visibility (each CLI call = separate activity)
- ✅ Debuggable (logs available at deterministic paths)

