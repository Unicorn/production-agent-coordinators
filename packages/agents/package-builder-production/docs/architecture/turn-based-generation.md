# Turn-Based Package Generation Architecture

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Generation Phases](#generation-phases)
4. [State Management](#state-management)
5. [Recovery System](#recovery-system)
6. [Token Budget Management](#token-budget-management)
7. [Git Integration](#git-integration)
8. [Performance Considerations](#performance-considerations)
9. [Error Handling](#error-handling)
10. [Future Enhancements](#future-enhancements)

## Overview

### What is Turn-Based Generation?

Turn-based generation is an iterative approach to package scaffolding that replaces single-shot generation with a multi-phase pipeline. Instead of generating an entire package in one large Claude API call, the system breaks the work into 15 focused phases, each making smaller API calls within manageable token budgets.

### Why Turn-Based Generation?

The original single-shot approach faced several challenges:

1. **Token Limit Violations**: Large packages exceeded Claude's 200K context window and 16K output token limit
2. **Rate Limit Issues**: Single large calls consumed the entire 8000 tokens/minute budget
3. **No Recovery**: Failures required starting from scratch
4. **Poor Debugging**: Hard to identify which part of generation failed
5. **No Incremental Progress**: Users couldn't see work being completed step-by-step

Turn-based generation solves these problems by:

- Keeping each API call under 8K tokens (well within limits)
- Spreading work over time to avoid rate limits
- Persisting state after each phase for recovery
- Committing to git after each phase for inspection
- Providing clear progress tracking through phases

### Key Benefits

- **Reliability**: Can recover from failures without starting over
- **Scalability**: Handles packages of any size
- **Observability**: Clear phase-by-phase progress tracking
- **Debuggability**: Each phase commits separately for easy inspection
- **Flexibility**: Can pause, resume, or retry individual phases

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                  PackageBuildTurnBasedWorkflow                  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐    │
│  │              GenerationContext                         │    │
│  │  - sessionId, branch, packageName                      │    │
│  │  - currentPhase, currentStepNumber                     │    │
│  │  - completedSteps[], requirements                      │    │
│  │  - lastSuccessfulCommit                                │    │
│  └───────────────────────────────────────────────────────┘    │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Phase Execution Loop                        │  │
│  │  for each phase in [PLANNING...MERGE]:                  │  │
│  │    1. Execute phase → Claude API call                   │  │
│  │    2. Parse response → file operations                  │  │
│  │    3. Apply changes → write files                       │  │
│  │    4. Record step → update context                      │  │
│  │    5. Commit to git → create checkpoint                 │  │
│  │    6. Save state → persist context                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              State Persistence                           │  │
│  │  .generation-state/${sessionId}.json                     │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
┌────────────────────┐
│   Temporal.io      │
│   Workflow         │
└─────────┬──────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              PackageBuildTurnBasedWorkflow                   │
│                                                              │
│  Responsibilities:                                           │
│  - Initialize or resume GenerationContext                   │
│  - Loop through 15 phases sequentially                      │
│  - Coordinate phase execution and state updates             │
│  - Handle errors and trigger recovery                       │
└──────┬──────────────────────────────────────────────────────┘
       │
       ├─────────────────┬─────────────────┬──────────────────┐
       ▼                 ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Phase      │  │    State     │  │     Git      │  │   Report     │
│  Executor    │  │  Manager     │  │  Operations  │  │   Writer     │
│  Activities  │  │  Activities  │  │  Activities  │  │  Activities  │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
       │                 │
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────────────────┐
│  Claude API  │  │  File System             │
│              │  │  .generation-state/      │
│  - Prompts   │  │  ${sessionId}.json       │
│  - Responses │  │                          │
└──────────────┘  └──────────────────────────┘
```

### Data Flow

1. **Initialization**:
   - Create new `GenerationContext` or load existing from disk
   - Set phase to `PLANNING`, step to `0`
   - Save initial context to `.generation-state/${sessionId}.json`

2. **Phase Execution**:
   - Build phase-specific prompt with context
   - Call Claude API with appropriate token budget and temperature
   - Parse response into file operations
   - Apply file changes to workspace
   - Record step completion in context

3. **Checkpoint Creation**:
   - Commit all changes to git with descriptive message
   - Record commit hash in context
   - Save updated context to disk

4. **Recovery Trigger**:
   - If phase fails, mark context as failed
   - Save error details and retry count
   - Return failure to workflow
   - Workflow can retry or escalate

## Generation Phases

The turn-based workflow consists of 15 phases executed sequentially. Each phase has a specific purpose, token budget, and temperature setting.

### Phase Overview

| Phase | Purpose | Token Budget | Temperature | Duration |
|-------|---------|--------------|-------------|----------|
| PLANNING | Create plan, MECE validation, blueprint | 5000 | 0.3 | 2-3 min |
| FOUNDATION | Config files (package.json, tsconfig) | 3000 | 0.2 | 1-2 min |
| TYPES | Type definitions (src/types/index.ts) | 4000 | 0.2 | 1-2 min |
| CORE_IMPLEMENTATION | Main implementation files | 8000 | 0.3 | 3-4 min |
| ENTRY_POINT | Barrel file (src/index.ts) | 2000 | 0.2 | 1 min |
| UTILITIES | Helper functions (src/utils/) | 4000 | 0.3 | 2 min |
| ERROR_HANDLING | Error classes (src/errors/) | 3000 | 0.3 | 1-2 min |
| TESTING | Test files (src/__tests__/) | 6000 | 0.3 | 3-4 min |
| DOCUMENTATION | README, JSDoc updates | 3000 | 0.4 | 2 min |
| EXAMPLES | Usage examples (examples/) | 4000 | 0.4 | 2 min |
| INTEGRATION_REVIEW | Review integrations, report issues | 4000 | 0.3 | 2 min |
| CRITICAL_FIXES | Fix issues from review | 5000 | 0.3 | 2-3 min |
| BUILD_VALIDATION | Run build, tests, lint, fix issues | 4000 | 0.3 | 2-3 min |
| FINAL_POLISH | Final quality pass, checklist | 3000 | 0.3 | 1-2 min |
| MERGE | Create PR, final validation | - | - | Manual |

**Total Token Budget**: ~58,000 tokens across all phases
**Total Estimated Time**: 25-35 minutes

### Detailed Phase Descriptions

#### 1. PLANNING

**Purpose**: Establish package architecture and validate with MECE principles.

**Outputs**:
- Package plan document
- Architecture blueprint (docs/architecture.md)
- MECE validation report

**Key Activities**:
- Define package purpose and scope
- Identify core interfaces and types
- List main implementation files
- Plan dependencies and integrations
- Define testing strategy
- Validate MECE (Mutually Exclusive, Collectively Exhaustive)

**Context Updates**:
```typescript
requirements: {
  meceValidated: true,
  planApproved: true
}
```

#### 2. FOUNDATION

**Purpose**: Generate configuration files for the package.

**Outputs**:
- `package.json` with all required fields
- `tsconfig.json` with strict mode
- `.eslintrc.json` for TypeScript
- `.gitignore`
- `jest.config.cjs` or `vitest.config.ts` with coverage thresholds

**Key Activities**:
- Set package name, version, description
- Configure TypeScript compilation
- Set up linting rules
- Define test coverage targets
- Configure module resolution

**Quality Checks**:
- All required package.json fields present
- TypeScript strict mode enabled
- Coverage thresholds match category (90% core, 85% service, 80% suite/ui)

#### 3. TYPES

**Purpose**: Generate TypeScript type definitions.

**Outputs**:
- `src/types/index.ts` with core interfaces

**Key Activities**:
- Define public API interfaces
- Create type aliases for common patterns
- Add enums for fixed value sets
- Write comprehensive JSDoc comments
- Export all types for consumers

**Quality Checks**:
- No `any` types used
- All exports have JSDoc
- Types follow naming conventions (PascalCase)

#### 4. CORE_IMPLEMENTATION

**Purpose**: Implement main package functionality.

**Outputs**:
- Implementation files in `src/`
- Business logic and algorithms
- Integration with types

**Key Activities**:
- Implement core functionality
- Add input validation
- Handle edge cases
- Integrate logger (if required)
- Integrate neverhub (if required)
- Use strict TypeScript

**Quality Checks**:
- All functions have JSDoc
- No `any` types
- Proper error handling
- `.js` extensions in imports

**Largest Token Budget**: 8000 tokens (most complex phase)

#### 5. ENTRY_POINT

**Purpose**: Create barrel file for clean public API.

**Outputs**:
- `src/index.ts` with re-exports

**Key Activities**:
- Export all public types
- Export main functions
- Group exports logically
- Add package-level JSDoc header
- Use `.js` extensions in imports

**Quality Checks**:
- No internal utilities exported
- No test files exported
- Clean, organized structure

#### 6. UTILITIES

**Purpose**: Generate helper functions and utilities.

**Outputs**:
- Utility files in `src/utils/`

**Key Activities**:
- Create data transformations
- Add validation helpers
- Implement formatting functions
- Define constants
- Create reusable pure functions

**Quality Checks**:
- Complete JSDoc with examples
- Fully typed (no `any`)
- Pure functions where possible
- Input validation included

#### 7. ERROR_HANDLING

**Purpose**: Create error infrastructure.

**Outputs**:
- Error classes in `src/errors/`

**Key Activities**:
- Define custom error classes
- Create error codes/types enum
- Implement error factory functions
- Add error serialization helpers
- Support error chaining

**Quality Checks**:
- Proper Error prototype chain
- Error codes defined
- Context information captured
- JSDoc explains when thrown

#### 8. TESTING

**Purpose**: Generate comprehensive test suite.

**Outputs**:
- Test files in `src/__tests__/`

**Key Activities**:
- Write unit tests for all public functions
- Add integration tests
- Test edge cases
- Test error conditions
- Mock external dependencies

**Quality Checks**:
- Coverage meets target (90%/85%/80%)
- Clear test descriptions
- Arrange-Act-Assert pattern
- Both success and failure cases tested

**Second Largest Token Budget**: 6000 tokens (comprehensive tests)

#### 9. DOCUMENTATION

**Purpose**: Create comprehensive documentation.

**Outputs**:
- `README.md` with complete guide
- Updated JSDoc comments in source files

**Key Activities**:
- Write package description
- Add installation instructions
- Create quick start guide
- Document API reference
- List configuration options
- Link to examples

**Quality Checks**:
- All code examples work
- Clear and concise writing
- Professional tone
- Markdown formatting correct

#### 10. EXAMPLES

**Purpose**: Generate usage examples.

**Outputs**:
- Example files in `examples/`
- `examples/README.md`

**Key Activities**:
- Create basic.ts (getting started)
- Create advanced.ts (complex patterns)
- Create error-handling.ts
- Create integration.ts (if applicable)
- Add examples README

**Quality Checks**:
- Self-contained and runnable
- Well-commented
- Show realistic use cases
- Demonstrate best practices

#### 11. INTEGRATION_REVIEW

**Purpose**: Review and validate all integrations.

**Outputs**:
- `INTEGRATION_REVIEW.md` report

**Key Activities**:
- Review logger usage
- Validate neverhub integration
- Check error propagation
- Verify type safety
- Assess configuration flexibility
- Validate test mocks

**Quality Checks**:
- All integrations working correctly
- No issues found or documented
- Recommendations provided

#### 12. CRITICAL_FIXES

**Purpose**: Address issues found in integration review.

**Outputs**:
- Fixed source files
- Updated tests

**Key Activities**:
- Fix type safety issues
- Close error handling gaps
- Add missing validation
- Resolve integration issues
- Address security concerns

**Quality Checks**:
- All critical issues resolved
- Tests added for fixes
- No regressions introduced

#### 13. BUILD_VALIDATION

**Purpose**: Validate package builds and tests pass.

**Outputs**:
- `BUILD_VALIDATION.md` report
- Fixed files (if issues found)

**Key Activities**:
- Run TypeScript compilation
- Execute test suite
- Run linter
- Perform type checking
- Fix any issues found

**Quality Checks**:
- All tests passing
- Coverage meets target
- Zero TypeScript errors
- Zero lint errors

#### 14. FINAL_POLISH

**Purpose**: Final quality pass before merge.

**Outputs**:
- `FINAL_CHECKLIST.md`
- Polished source files

**Key Activities**:
- Review code quality
- Verify JSDoc completeness
- Check naming consistency
- Improve error messages
- Remove TODO comments
- Fix typos

**Quality Checks**:
- Clean, readable code
- Consistent style
- No console.log in production
- All imports use `.js` extensions
- Package.json metadata complete

#### 15. MERGE

**Purpose**: Prepare for merge to main branch.

**Activities** (Manual or Semi-Automated):
- Create pull request
- Run final validation
- Review checklist
- Merge to main

**Not Implemented**: This phase is currently manual, but could be automated with `gh` CLI integration.

## State Management

### GenerationContext Structure

The `GenerationContext` is the core state object persisted throughout the workflow:

```typescript
interface GenerationContext {
  // Session identification
  sessionId: string;           // e.g., "gen-1732198765432"
  branch: string;              // e.g., "feat/package-generation-1732198765432"

  // Package metadata
  packageName: string;         // e.g., "@bernierllc/data-validator"
  packageCategory: PackageCategory; // "core" | "service" | "suite" | "ui" | "validator"
  packagePath: string;         // e.g., "packages/core/data-validator"
  planPath: string;            // e.g., "plans/packages/core/data-validator.md"
  workspaceRoot: string;       // e.g., "/Users/user/projects/repo"

  // Current state
  currentPhase: GenerationPhase;   // Current phase being executed
  currentStepNumber: number;       // Current step number (increments across phases)
  completedSteps: GenerationStep[]; // History of completed steps

  // Requirements and validation
  requirements: {
    testCoverageTarget: number;  // 90, 85, or 80 based on category
    loggerIntegration: 'integrated' | 'planned' | 'not-applicable';
    neverhubIntegration: 'integrated' | 'planned' | 'not-applicable';
    docsSuiteIntegration: 'ready' | 'planned';
    meceValidated: boolean;      // Set to true after PLANNING phase
    planApproved: boolean;       // Set to true after PLANNING phase
  };

  // Recovery support
  lastSuccessfulCommit?: string;   // Git commit hash of last successful phase
  failureRecovery?: {
    failedStep: number;            // Step that failed
    error: string;                 // Error message
    retryCount: number;            // Number of retry attempts
  };
}
```

### GenerationStep Structure

Each completed step is recorded with full details:

```typescript
interface GenerationStep {
  stepNumber: number;          // Sequential step number (1, 2, 3, ...)
  phase: GenerationPhase;      // Which phase this step belongs to
  description: string;         // Human-readable description
  files: string[];             // Files modified in this step
  commit?: string;             // Git commit hash (if committed)
  timestamp: number;           // Unix timestamp of completion
  claudeTokensUsed?: {         // Token usage (future enhancement)
    input: number;
    output: number;
  };
}
```

### State File Location

State files are stored in `.generation-state/` directory:

```
workspace-root/
  .generation-state/
    gen-1732198765432.json     # Active session
    gen-1732195432123.json     # Completed session
    gen-1732192345678.json     # Failed session
```

Each session has a unique file for isolation and history tracking.

### State File Format

```json
{
  "sessionId": "gen-1732198765432",
  "branch": "feat/package-generation-1732198765432",
  "packageName": "@bernierllc/data-validator",
  "packageCategory": "core",
  "packagePath": "packages/core/data-validator",
  "planPath": "plans/packages/core/data-validator.md",
  "workspaceRoot": "/Users/user/projects/repo",
  "currentPhase": "TYPES",
  "currentStepNumber": 3,
  "completedSteps": [
    {
      "stepNumber": 1,
      "phase": "PLANNING",
      "description": "Created package plan and architecture blueprint",
      "files": ["docs/architecture.md", "plans/packages/core/data-validator.md"],
      "commit": "abc123def456",
      "timestamp": 1732198770000
    },
    {
      "stepNumber": 2,
      "phase": "FOUNDATION",
      "description": "Generated configuration files",
      "files": ["package.json", "tsconfig.json", ".eslintrc.json", ".gitignore", "jest.config.cjs"],
      "commit": "def456ghi789",
      "timestamp": 1732198850000
    }
  ],
  "requirements": {
    "testCoverageTarget": 90,
    "loggerIntegration": "not-applicable",
    "neverhubIntegration": "not-applicable",
    "docsSuiteIntegration": "planned",
    "meceValidated": true,
    "planApproved": true
  },
  "lastSuccessfulCommit": "def456ghi789",
  "savedAt": "2024-11-21T16:47:30.000Z"
}
```

### State Persistence Operations

#### Save State

Called after every phase completion:

```typescript
await saveGenerationState(context);
```

Creates/updates `.generation-state/${sessionId}.json` with full context.

#### Load State

Called when resuming a session:

```typescript
const context = await loadGenerationState(sessionId, workspaceRoot);
if (context) {
  // Resume from this context
}
```

Returns `null` if session not found.

#### Record Step

Called after each step within a phase:

```typescript
await recordCompletedStep(context, {
  stepNumber: context.currentStepNumber + 1,
  phase: 'FOUNDATION',
  description: 'Generated configuration files',
  files: ['package.json', 'tsconfig.json']
});
```

Appends step to `completedSteps[]` and saves context.

#### Mark Failed

Called when a phase fails:

```typescript
await markContextFailed(context, stepNumber, error);
```

Records failure details for recovery analysis.

## Recovery System

### Recovery Scenarios

#### Scenario 1: Workflow Crash

**Problem**: Temporal workflow crashes or times out mid-phase.

**Recovery**:
1. Load context from disk: `loadGenerationState(sessionId, workspaceRoot)`
2. Resume workflow with: `resumeFromContext: context`
3. Workflow skips completed phases using `shouldSkipPhase()`
4. Continues from next uncompleted phase

**Example**:
```typescript
// First run crashes at TYPES phase
const input: TurnBasedPackageBuildInput = {
  packageName: '@bernierllc/data-validator',
  // ... other fields ...
  enableTurnBasedGeneration: true
};

// Resume after crash
const context = await loadGenerationState('gen-1732198765432', '/workspace');
const resumeInput: TurnBasedPackageBuildInput = {
  ...input,
  resumeFromContext: context  // Resume from TYPES phase
};
```

#### Scenario 2: Phase Failure

**Problem**: A phase fails (e.g., Claude API error, file write error).

**Recovery**:
1. Workflow marks context as failed with error details
2. Error is logged and saved to state file
3. Workflow can:
   - Retry the phase automatically (with exponential backoff)
   - Return failure and wait for manual intervention
   - Skip to next phase if phase is optional

**Example**:
```typescript
// Phase fails
const result = await executeTypesPhase(context);
if (!result.success) {
  await markContextFailed(context, context.currentStepNumber, result.error);

  // Check retry count
  if (context.failureRecovery && context.failureRecovery.retryCount < 3) {
    // Retry after delay
    await sleep(60000); // 1 minute
    return executeTypesPhase(context);
  }

  throw new Error(`Phase TYPES failed after 3 retries: ${result.error}`);
}
```

#### Scenario 3: Git Conflict

**Problem**: Git commit fails due to conflict or dirty working directory.

**Recovery**:
1. Workflow logs the git error
2. Saves context with current uncommitted changes
3. Operator resolves git conflict manually
4. Workflow resumes and re-commits

**Manual Steps**:
```bash
# Resolve conflict
git status
git add .
git commit -m "Resolve conflict"

# Resume workflow with same input
```

#### Scenario 4: Token Budget Exceeded

**Problem**: A phase exceeds its token budget (rare, but possible).

**Recovery**:
1. Claude API returns error about token limit
2. Workflow catches error and marks phase as failed
3. Operator can:
   - Increase token budget in phase executor
   - Split phase into sub-phases
   - Simplify prompt to reduce tokens

**Code Change**:
```typescript
// Increase budget for problematic phase
const claudeResponse = await executeAgentWithClaude({
  prompt,
  model: 'claude-sonnet-4-5-20250929',
  temperature: 0.2,
  maxTokens: 10000  // Increased from 8000
});
```

### Recovery Checklist

When recovering from a failure:

1. **Identify Session**:
   - Find session ID from logs or state directory
   - Load context: `loadGenerationState(sessionId, workspaceRoot)`

2. **Analyze Failure**:
   - Check `context.failureRecovery.error`
   - Review `context.completedSteps` to see what succeeded
   - Check git log for last successful commit

3. **Determine Resolution**:
   - Transient error (API timeout)? Retry immediately
   - Configuration error? Fix and retry
   - Code bug? Fix phase executor and retry
   - Git conflict? Resolve manually and retry

4. **Resume Workflow**:
   - Use same input as original run
   - Add `resumeFromContext: context`
   - Workflow will skip completed phases

5. **Verify Success**:
   - Check workflow completes all remaining phases
   - Verify git commits for each phase
   - Review final output

### Recovery Commands

```bash
# List all sessions
ls -la .generation-state/

# View session details
cat .generation-state/gen-1732198765432.json | jq

# Check last commit
git log --oneline -10

# Checkout session branch
git checkout feat/package-generation-1732198765432

# View uncommitted changes
git status
git diff
```

## Token Budget Management

### Budget Rationale

Token budgets are designed to:
1. Stay well under Claude's 16K output limit
2. Avoid hitting 8000 tokens/minute rate limit
3. Allow buffer for unexpected prompt expansion
4. Balance between quality and speed

### Budget Allocation

| Phase | Budget | Justification |
|-------|--------|---------------|
| PLANNING | 5000 | Comprehensive plan, blueprint, MECE validation |
| FOUNDATION | 3000 | Config files are mostly boilerplate |
| TYPES | 4000 | Type definitions require precision |
| CORE_IMPLEMENTATION | 8000 | Most complex, main business logic |
| ENTRY_POINT | 2000 | Simple barrel file |
| UTILITIES | 4000 | Multiple utility functions |
| ERROR_HANDLING | 3000 | Error classes and handlers |
| TESTING | 6000 | Comprehensive test coverage |
| DOCUMENTATION | 3000 | README and JSDoc updates |
| EXAMPLES | 4000 | Multiple example files |
| INTEGRATION_REVIEW | 4000 | Review and analysis |
| CRITICAL_FIXES | 5000 | Fixes based on review |
| BUILD_VALIDATION | 4000 | Validation and fixes |
| FINAL_POLISH | 3000 | Final quality pass |

**Total**: ~58,000 tokens across 14 phases (excluding MERGE)

### Rate Limit Compliance

Claude API rate limit: **8000 tokens/minute**

With our budgets:
- Largest phase (CORE_IMPLEMENTATION): 8000 tokens ≈ 1 minute
- Average phase: 4000 tokens ≈ 30 seconds
- Sequential execution ensures we never exceed rate limit

**Total generation time**: 25-35 minutes for all phases

### Budget Adjustment

If a phase consistently exceeds its budget:

1. **Analyze Why**:
   - Is prompt too complex?
   - Is package unusually large?
   - Is phase doing too much?

2. **Solutions**:
   - Increase budget (up to 8000 max)
   - Split phase into sub-phases
   - Simplify prompt instructions
   - Reduce few-shot examples

3. **Update Code**:
   ```typescript
   const claudeResponse = await executeAgentWithClaude({
     prompt,
     model: 'claude-sonnet-4-5-20250929',
     temperature: 0.3,
     maxTokens: 6000  // Adjusted from 4000
   });
   ```

### Temperature Settings

Temperature controls response randomness:

- **0.2**: Deterministic (config files, types, entry points)
- **0.3**: Slightly creative (implementation, testing, fixes)
- **0.4**: More creative (documentation, examples)

Lower temperature = more consistent output
Higher temperature = more varied/creative output

## Git Integration

### Commit Strategy

Each phase creates a git commit upon successful completion:

```
feat(planning): complete PLANNING phase for @bernierllc/data-validator

Files modified: docs/architecture.md, plans/packages/core/data-validator.md

[Turn-based generation step 1]
```

### Commit Benefits

1. **Recovery Points**: Can roll back to any phase
2. **Debugging**: Inspect changes phase-by-phase
3. **Auditing**: Clear history of generation process
4. **Collaboration**: Team can review intermediate states

### Commit Message Format

```
feat(<phase>): complete <PHASE> phase for <package-name>

Files modified: <file1>, <file2>, <file3>

[Turn-based generation step <N>]
```

Example:
```
feat(foundation): complete FOUNDATION phase for @bernierllc/data-validator

Files modified: package.json, tsconfig.json, .eslintrc.json, .gitignore, jest.config.cjs

[Turn-based generation step 2]
```

### Branch Strategy

Each generation session creates a dedicated branch:

```
feat/package-generation-<timestamp>
```

Example: `feat/package-generation-1732198765432`

This ensures:
- Isolation from other work
- Easy cleanup if generation fails
- Clear identification in git log

### Git Operations

#### Initial Commit

After PLANNING phase completes:
```bash
git checkout -b feat/package-generation-1732198765432
git add docs/architecture.md plans/packages/core/data-validator.md
git commit -m "feat(planning): complete PLANNING phase for @bernierllc/data-validator"
```

#### Subsequent Commits

After each phase:
```bash
git add <modified-files>
git commit -m "<commit-message>"
```

Commit hash is stored in `context.lastSuccessfulCommit`.

#### Final Merge

After all phases complete:
```bash
git checkout main
git merge --no-ff feat/package-generation-1732198765432
git push origin main
```

Or create PR:
```bash
gh pr create --title "Add @bernierllc/data-validator package" \
  --body "Generated via turn-based workflow" \
  --base main \
  --head feat/package-generation-1732198765432
```

## Performance Considerations

### Execution Time

Total workflow execution time: **25-35 minutes**

Breakdown:
- Phase execution: 20-30 minutes (Claude API calls)
- Git operations: 2-3 minutes (commits, state saves)
- File operations: 1-2 minutes (writes, reads)

### Optimization Strategies

1. **Parallel Phases** (Future Enhancement):
   - Independent phases could run in parallel
   - Example: UTILITIES and ERROR_HANDLING could run concurrently
   - Would require more complex state management

2. **Caching** (Future Enhancement):
   - Cache Claude responses for identical prompts
   - Reduces API calls for retries
   - Saves ~30% time on recovery scenarios

3. **Prompt Optimization**:
   - Remove unnecessary context from prompts
   - Use more focused instructions
   - Reduce few-shot examples when not needed

4. **Skip Optional Phases**:
   - Allow configuration to skip certain phases
   - Example: Skip EXAMPLES phase for internal packages
   - Example: Skip INTEGRATION_REVIEW for simple packages

### Resource Usage

- **CPU**: Low (mostly I/O bound)
- **Memory**: ~100-200MB for context and state
- **Disk**: ~50KB per state file, grows with completedSteps
- **Network**: ~500KB per Claude API call (varies by phase)

### Monitoring

Track these metrics for performance analysis:

- Phase execution time
- Token usage per phase
- Success/failure rate per phase
- Recovery frequency
- Total workflow duration

## Error Handling

### Error Categories

1. **Transient Errors**:
   - Claude API timeout
   - Network issues
   - Temporary file system errors

   **Handling**: Retry with exponential backoff

2. **Configuration Errors**:
   - Invalid token budget
   - Missing workspace directory
   - Invalid package category

   **Handling**: Fail fast with clear error message

3. **Code Errors**:
   - Bug in phase executor
   - Invalid file operation
   - Git command failure

   **Handling**: Mark phase as failed, save context, return error

4. **Claude Errors**:
   - Invalid response format
   - Token limit exceeded
   - Rate limit hit

   **Handling**: Retry with adjusted parameters or fail

### Error Response Structure

```typescript
interface PhaseExecutionResult {
  success: boolean;
  phase: GenerationPhase;
  steps: GenerationStep[];
  filesModified: string[];
  error?: string;  // Error message if success = false
}
```

### Error Recovery Flow

```
Phase Execution
      ↓
   Success?
   /     \
 Yes      No
  ↓       ↓
Record   Mark Failed
 Step       ↓
  ↓     Save Context
Commit      ↓
  ↓    Retry Count < 3?
Next    /         \
Phase  Yes         No
       ↓            ↓
   Retry        Throw Error
   (with delay)     ↓
       ↓        Workflow Fails
   Success?        ↓
   /     \     Return Failure
 Yes      No   to Caller
  ↓       ↓
Continue  Give Up
```

### Error Logging

All errors are logged with context:

```typescript
console.error(`[TurnBased] Phase ${phase} failed: ${result.error}`);
console.error(`[TurnBased] Session: ${context.sessionId}`);
console.error(`[TurnBased] Step: ${context.currentStepNumber}`);
console.error(`[TurnBased] Last successful commit: ${context.lastSuccessfulCommit}`);
```

## Future Enhancements

### Planned Features

1. **Parallel Phase Execution**:
   - Execute independent phases concurrently
   - Reduce total generation time by 30-40%
   - Requires coordination layer for dependencies

2. **Token Usage Tracking**:
   - Record actual tokens used per phase
   - Analyze trends and optimize budgets
   - Alert if phase consistently exceeds budget

3. **Claude Response Caching**:
   - Cache responses for identical prompts
   - Speed up retries and recovery
   - Reduce API costs

4. **Phase Dependencies**:
   - Explicit dependency graph between phases
   - Enable smarter ordering and parallelization
   - Skip unnecessary phases based on package type

5. **Interactive Mode**:
   - Pause after each phase for review
   - Allow manual edits before continuing
   - Useful for new package types

6. **Automated MERGE Phase**:
   - Integrate with GitHub API
   - Auto-create pull request
   - Run CI checks before merge

7. **Rollback Support**:
   - Roll back to any previous phase
   - Re-execute from that point forward
   - Useful when requirements change mid-generation

8. **Multi-Package Generation**:
   - Generate multiple packages in parallel
   - Share common context (workspace setup)
   - Coordinate dependencies between packages

9. **Custom Phases**:
   - Allow users to define custom phases
   - Plugin architecture for phase executors
   - Useful for organization-specific requirements

10. **AI Model Flexibility**:
    - Support multiple Claude models
    - Fallback to other AI providers
    - Model selection per phase based on complexity

### Research Areas

- **Prompt Engineering**: Optimize prompts to reduce token usage
- **Quality Metrics**: Automated quality scoring of generated code
- **Human-in-the-Loop**: Best practices for manual review between phases
- **Cost Optimization**: Balance speed, quality, and API costs
- **Template Library**: Build library of proven phase templates

## Conclusion

Turn-based generation represents a fundamental shift in how we approach package scaffolding. By breaking the process into focused, recoverable phases with explicit state management, we achieve:

- **Reliability**: No more "start from scratch" when something fails
- **Scalability**: Handle packages of any size without hitting limits
- **Observability**: Clear visibility into generation progress
- **Maintainability**: Easy to debug, extend, and optimize

The architecture is designed for production use with real packages, real developers, and real reliability requirements. Each phase is independently testable, recoverable, and optimizable.

As the system evolves, the phase-based architecture provides a solid foundation for enhancements like parallelization, caching, and custom phases while maintaining backward compatibility with existing state files and workflows.

For practical usage information, see the [Turn-Based Generation Guide](../guides/turn-based-generation-guide.md).
