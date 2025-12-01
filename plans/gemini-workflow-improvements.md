# Gemini Turn-Based Workflow Improvements

**Status**: Draft - Pending Approval
**Created**: 2025-11-26
**Author**: Claude (via Brainstorming Skill)

## Executive Summary

This plan addresses 4 critical gaps identified in the Gemini turn-based package generation workflow:

| Gap | Issue | Impact | Priority |
|-----|-------|--------|----------|
| 1 | Audit results ignored | Wasted tokens regenerating existing files | High |
| 2 | No per-file loop detection | Workflow loops 10+ times on same file | Critical |
| 3 | JSON files get markdown fences | tsconfig.json/package.json corruption | Critical |
| 4 | Resume not wired up | Can't pause/continue workflows | Medium |

## Gap 1: Audit Results Ignored (File Regeneration)

### Current State

In `package-build.workflow.ts` (lines 127-151):
- `auditPackageState()` runs and collects completion data
- Returns `completionPercentage`, `nextSteps`, `existingFiles`
- Data is **logged and ignored** - Gemini starts fresh every time

```typescript
// Current (line 136-137)
console.log(`[PreFlight] 📊 Audit results:`, audit);
console.log(`[PreFlight] 📈 Completion: ${audit.completionPercentage}%`);
// Then Gemini is called WITHOUT this context
```

### Proposed Solution

**Part A: Extend GeminiTurnBasedAgentInput**

Add optional `initialContext` field to pass audit data:

```typescript
// In types/index.ts
export interface PackageAuditContext {
  completionPercentage: number;
  existingFiles: string[];
  missingFiles: string[];
  nextSteps: string[];
  status: 'complete' | 'incomplete';
}

export interface GeminiTurnBasedAgentInput {
  // ... existing fields

  /** Pre-flight audit context - tells Gemini what already exists */
  initialContext?: PackageAuditContext;
}
```

**Part B: Pass audit to Gemini in package-build.workflow.ts**

```typescript
// After audit (around line 145)
const geminiInput: GeminiTurnBasedAgentInput = {
  packageName: input.packageName,
  packagePath: input.packagePath,
  planPath: input.planPath,
  workspaceRoot: input.workspaceRoot,
  category: input.category,
  gitUser: { name: 'Gemini Package Builder Agent', email: 'builder@bernier.llc' },

  // NEW: Pass audit context
  initialContext: audit.status === 'incomplete' ? {
    completionPercentage: audit.completionPercentage,
    existingFiles: audit.existingFiles,
    missingFiles: audit.missingFiles,
    nextSteps: audit.nextSteps,
    status: audit.status
  } : undefined
};
```

**Part C: Use context in determineNextAction prompt**

```typescript
// In gemini-agent.activities.ts, modify prompt generation
const existingFilesContext = input.initialContext ? `
## CURRENT PACKAGE STATE (from audit)

Package is ${input.initialContext.completionPercentage}% complete.

### Existing Files (DO NOT REGENERATE):
${input.initialContext.existingFiles.map(f => `- ${f}`).join('\n')}

### Missing Components:
${input.initialContext.missingFiles.map(f => `- ${f}`).join('\n')}

### Your Task:
${input.initialContext.nextSteps.map(s => `- ${s}`).join('\n')}

IMPORTANT: Focus ONLY on missing components. Do not regenerate existing files.
` : '';
```

### Files Modified

1. `src/types/index.ts` - Add `PackageAuditContext` interface
2. `src/workflows/gemini-turn-based-agent.workflow.ts` - Accept and use `initialContext`
3. `src/workflows/package-build.workflow.ts` - Pass audit results to Gemini input
4. `src/activities/gemini-agent.activities.ts` - Include context in prompt

---

## Gap 2: Per-File Loop Detection with Meta-Correction

### Current State

In `gemini-turn-based-agent.workflow.ts` (lines 362-400):
- Only lint error tracking exists (`consecutiveLintFailures`)
- Compares entire error message for equality
- No per-file tracking - tsconfig.json looped 10+ times

### Proposed Solution

**Part A: New FileFailureTracker Type**

```typescript
// In types/index.ts
export interface FileFailureEntry {
  modificationCount: number;
  errors: string[];
  metaCorrectionSent: boolean;
  metaCorrectionAttempts: number;
  lastErrorHash: string; // Hash of error for comparison
}

export type FileFailureTracker = Record<string, FileFailureEntry>;
```

**Part B: Track file modifications in workflow**

```typescript
// In gemini-turn-based-agent.workflow.ts

const MAX_FILE_MODIFICATIONS_BEFORE_META = 3;
const MAX_META_CORRECTION_ATTEMPTS = 2;

// Add to workflow state
const fileFailureTracker: FileFailureTracker = {};

// After APPLY_CODE_CHANGES fails or after any validation failure
function trackFileFailure(filePath: string, errorMessage: string): 'continue' | 'meta_correct' | 'terminate' {
  const errorHash = hashError(errorMessage);

  if (!fileFailureTracker[filePath]) {
    fileFailureTracker[filePath] = {
      modificationCount: 1,
      errors: [errorMessage],
      metaCorrectionSent: false,
      metaCorrectionAttempts: 0,
      lastErrorHash: errorHash
    };
    return 'continue';
  }

  const entry = fileFailureTracker[filePath];

  // Check if same error repeating
  if (entry.lastErrorHash === errorHash) {
    entry.modificationCount++;

    // Threshold 1: Send meta-correction after 3 failures
    if (entry.modificationCount >= MAX_FILE_MODIFICATIONS_BEFORE_META && !entry.metaCorrectionSent) {
      entry.metaCorrectionSent = true;
      entry.metaCorrectionAttempts = 0;
      return 'meta_correct';
    }

    // Threshold 2: After meta-correction, allow 2 more attempts
    if (entry.metaCorrectionSent) {
      entry.metaCorrectionAttempts++;

      if (entry.metaCorrectionAttempts > MAX_META_CORRECTION_ATTEMPTS) {
        return 'terminate';
      }
      return 'meta_correct'; // Keep sending meta-correction
    }
  } else {
    // Different error - reset counter but keep history
    entry.modificationCount = 1;
    entry.lastErrorHash = errorHash;
    entry.errors.push(errorMessage);
  }

  return 'continue';
}
```

**Part C: Meta-Correction Message Format**

```typescript
function buildMetaCorrectionMessage(
  filePath: string,
  entry: FileFailureEntry,
  expectedFormat: string,
  observedIssue: string
): string {
  const remainingAttempts = MAX_META_CORRECTION_ATTEMPTS - entry.metaCorrectionAttempts;

  return `
## STUCK ON FILE: ${filePath}

You have attempted to modify ${filePath} ${entry.modificationCount} times with the same error.

### Expected Response Format
${expectedFormat}

### Issue Observed
${observedIssue}

### Specific Error
${entry.errors[entry.errors.length - 1].substring(0, 500)}

### Instructions
1. Review the error message carefully
2. Check if your file content has the correct format
3. For JSON files: Do NOT use markdown code fences
4. Adjust your response to resolve this issue

You have ${remainingAttempts} attempts remaining before this workflow terminates.
`.trim();
}
```

**Part D: Integration into main loop**

```typescript
// In APPLY_CODE_CHANGES error handling (around line 240)
case 'APPLY_CODE_CHANGES': {
  try {
    const result = await applyCodeChanges({...});

    // Reset failure tracking for successfully modified files
    for (const file of result.filesModified) {
      delete fileFailureTracker[file];
    }

    // ... existing success handling
  } catch (applyError) {
    // Extract file path from error
    const errorFilePaths = extractErrorFilePaths(errorMessage);

    for (const filePath of errorFilePaths) {
      const action = trackFileFailure(filePath, errorMessage);

      if (action === 'terminate') {
        throw ApplicationFailure.create({
          message: `Workflow terminated: Unable to fix ${filePath} after ${MAX_FILE_MODIFICATIONS_BEFORE_META + MAX_META_CORRECTION_ATTEMPTS} attempts`,
          type: 'FILE_LOOP_TERMINATION',
          nonRetryable: true
        });
      }

      if (action === 'meta_correct') {
        const metaMessage = buildMetaCorrectionMessage(
          filePath,
          fileFailureTracker[filePath],
          'JSON files must be raw JSON without markdown fences',
          'Content wrapped in ```json``` code blocks'
        );
        currentCodebaseContext = metaMessage;
      }
    }
  }
}
```

### Files Modified

1. `src/types/index.ts` - Add `FileFailureEntry`, `FileFailureTracker`
2. `src/workflows/gemini-turn-based-agent.workflow.ts` - Add tracking logic and meta-correction

---

## Gap 3: JSON File Handling (Markdown Fences Breaking JSON)

### Current State

In `gemini-agent.activities.ts` (lines 411-466):
- Prompt doesn't explicitly forbid markdown fences for JSON
- Gemini wraps JSON content in ` ```json ... ``` ` blocks
- This causes parse errors: `TS5092: The root value of a 'tsconfig.json' file must be an object`

### Proposed Solution

**Part A: Add JSON-specific instructions to prompt**

```typescript
// In determineNextAction, add to prompt template (around line 440)

const jsonFileHandlingInstructions = `
## CRITICAL: JSON FILE HANDLING

For all JSON files (package.json, tsconfig.json, *.json):

CORRECT FORMAT:
##---Content-Break-0---##
{
  "compilerOptions": {
    "strict": true
  }
}

INCORRECT FORMAT (DO NOT DO THIS):
##---Content-Break-0---##
\`\`\`json
{
  "compilerOptions": {
    "strict": true
  }
}
\`\`\`

RULES:
1. NO markdown code fences (\`\`\`json or \`\`\`) around JSON content
2. NO template literals or backticks anywhere in JSON content
3. Write raw, valid JSON that can be parsed directly by JSON.parse()
4. The content after ##---Content-Break-N---## must be the raw file content
`;
```

**Part B: Add content sanitizer in applyCodeChanges**

```typescript
// In gemini-agent.activities.ts, new helper function

/**
 * Sanitizes file content before writing.
 * Specifically handles JSON files that may have markdown fences.
 */
function sanitizeFileContent(content: string, filePath: string, logger: any): string {
  // Only sanitize JSON files
  if (!filePath.endsWith('.json')) {
    return content;
  }

  // Pattern 1: ```json ... ``` (with optional language tag)
  const fencePattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/;
  const match = content.match(fencePattern);

  if (match) {
    logger.warn(`Stripped markdown fences from JSON file: ${filePath}`);
    const cleanContent = match[1].trim();

    // Validate it's actually valid JSON
    try {
      JSON.parse(cleanContent);
      return cleanContent;
    } catch (e) {
      logger.error(`JSON still invalid after stripping fences: ${filePath}`);
      // Return original if parsing fails - let the error propagate naturally
      return content;
    }
  }

  // Pattern 2: Leading/trailing backticks without full fence
  let cleaned = content.trim();
  if (cleaned.startsWith('`') && cleaned.endsWith('`')) {
    cleaned = cleaned.slice(1, -1).trim();
    logger.warn(`Stripped backticks from JSON file: ${filePath}`);
  }

  return cleaned;
}
```

**Part C: Apply sanitizer before file write**

```typescript
// In applyCodeChanges, before calling applyHybridFileOperations

// Sanitize content blocks for JSON files
const sanitizedContentBlocks = new Map<number, string>();
for (const [index, content] of contentBlocksMap.entries()) {
  const fileOp = normalizedFiles.find(f => f.index === index);
  if (fileOp) {
    const sanitized = sanitizeFileContent(content, fileOp.path, logger);
    sanitizedContentBlocks.set(index, sanitized);
  } else {
    sanitizedContentBlocks.set(index, content);
  }
}

// Use sanitized content for file operations
const result = await applyHybridFileOperations(
  normalizedFiles,
  sanitizedContentBlocks,  // Use sanitized version
  { basePath: fullPackagePath, createDirectories: true, logger: {...} }
);
```

### Files Modified

1. `src/activities/gemini-agent.activities.ts`:
   - Add `jsonFileHandlingInstructions` to prompt
   - Add `sanitizeFileContent()` function
   - Apply sanitization in `applyCodeChanges()`

---

## Gap 4: Resume Support (Temporal State Only)

### Current State

In `types/index.ts` (line 397):
- `resumeFromContext?: GenerationContext` exists
- Not wired up in workflow
- User decision: "Temporal state only" (rely on Temporal's built-in replay)

### Proposed Solution

**Part A: Add Temporal Query for Workflow State**

```typescript
// In gemini-turn-based-agent.workflow.ts

import { defineQuery, setHandler } from '@temporalio/workflow';

// Define query for current workflow state
export interface WorkflowStateSnapshot {
  loopCount: number;
  currentPhase: string;
  filesModified: string[];
  actionHistoryLength: number;
  fileFailureTracker: FileFailureTracker;
  lastSuccessfulIteration: number;
}

export const getWorkflowStateQuery = defineQuery<WorkflowStateSnapshot>('getWorkflowState');

// Inside workflow function, after state initialization
setHandler(getWorkflowStateQuery, () => ({
  loopCount,
  currentPhase: 'GENERATING', // or derive from action history
  filesModified,
  actionHistoryLength: actionHistory.length,
  fileFailureTracker,
  lastSuccessfulIteration: loopCount
}));
```

**Part B: Document Resume Procedure**

Resume is handled by Temporal's built-in history replay:

1. **Query current state**: Use `getWorkflowState` query to see where workflow is
2. **Terminate gracefully**: Send a signal to save state if needed
3. **Restart with same ID**: Temporal replays history, workflow continues

```typescript
// Example: Querying workflow state from CLI or admin tool
const handle = client.workflow.getHandle(workflowId);
const state = await handle.query(getWorkflowStateQuery);
console.log(`Workflow at iteration ${state.loopCount}, ${state.filesModified.length} files modified`);
```

**Part C: Add graceful shutdown signal**

```typescript
// New signal for graceful pause
export const gracefulPauseSignal = defineSignal('gracefulPause');

// In workflow
let pauseRequested = false;
setHandler(gracefulPauseSignal, () => {
  pauseRequested = true;
  log.info('[Gemini] Graceful pause requested, will stop after current iteration');
});

// In main loop, check pause flag
while (loopCount < MAX_LOOP_ITERATIONS && !pauseRequested) {
  // ... existing loop logic
}

if (pauseRequested) {
  return {
    success: false,
    filesModified,
    actionHistory,
    totalIterations: loopCount,
    error: 'Workflow paused by user request'
  };
}
```

### Files Modified

1. `src/workflows/gemini-turn-based-agent.workflow.ts`:
   - Add `getWorkflowStateQuery` definition
   - Add `gracefulPauseSignal` for clean stopping
   - Check pause flag in main loop

---

## Implementation Order

1. **Gap 3: JSON File Handling** (Critical, Quick Win)
   - Prevents immediate failures
   - Can be done in isolation
   - Low risk

2. **Gap 2: Per-File Loop Detection** (Critical, Core Feature)
   - Depends on Gap 3 being done first
   - Core improvement to prevent infinite loops
   - Medium complexity

3. **Gap 1: Audit Context Passing** (High, Optimization)
   - Token/cost savings
   - Requires coordination between workflows
   - Medium complexity

4. **Gap 4: Resume Support** (Medium, Nice-to-Have)
   - Relies on Temporal built-ins
   - Mostly documentation + queries
   - Low complexity

## Testing Strategy

### Unit Tests

- `sanitizeFileContent()` with various inputs
- `trackFileFailure()` state transitions
- Meta-correction message generation

### Integration Tests

- Workflow with audit context vs without
- Workflow hitting file loop → meta-correction → termination
- JSON file with markdown fences → sanitized and written

### Manual Testing

- Run contentful-types build with 67% existing code
- Intentionally cause a loop on tsconfig.json
- Verify meta-correction messages appear

---

## Approval Checklist

- [ ] Gap 1: Audit context design approved
- [ ] Gap 2: Meta-correction escalation (3 failures → meta → 2 more → terminate) approved
- [ ] Gap 3: JSON sanitization approach approved
- [ ] Gap 4: Temporal-only resume approach approved
- [ ] Implementation order approved
