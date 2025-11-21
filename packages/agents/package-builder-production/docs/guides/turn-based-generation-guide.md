# Turn-Based Package Generation Operator Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Configuration](#configuration)
3. [Running Workflows](#running-workflows)
4. [Monitoring Progress](#monitoring-progress)
5. [Recovery Procedures](#recovery-procedures)
6. [Troubleshooting](#troubleshooting)
7. [Performance Tuning](#performance-tuning)
8. [Best Practices](#best-practices)

## Getting Started

### Prerequisites

Before using turn-based generation, ensure you have:

1. **Temporal.io Setup**:
   ```bash
   # Start Temporal dev server
   temporal server start-dev
   ```

2. **Claude API Access**:
   - API key configured
   - Access to `claude-sonnet-4-5-20250929` model
   - Rate limit: 8000 tokens/minute minimum

3. **Package Dependencies**:
   ```bash
   cd packages/agents/package-builder-production
   yarn install
   yarn build
   ```

4. **Git Repository**:
   - Clean working directory
   - Git user configured:
     ```bash
     git config user.name "Package Builder"
     git config user.email "builder@bernier.llc"
     ```

### Quick Start

1. **Enable Turn-Based Generation**:

   Create or update your build configuration:

   ```typescript
   import type { BuildConfig } from '@bernierllc/package-builder-production';

   const config: BuildConfig = {
     // ... existing config ...

     turnBasedGeneration: {
       enabled: true  // Enable turn-based workflow
     }
   };
   ```

2. **Prepare Package Plan**:

   Create a package plan at `plans/packages/<category>/<package-name>.md`:

   ```markdown
   # Package: @bernierllc/data-validator

   ## Purpose
   Validate data structures against schemas with comprehensive error reporting.

   ## Core Interfaces
   - ValidatorConfig
   - ValidationResult
   - SchemaDefinition

   ## Implementation Files
   - src/validator.ts
   - src/schema-parser.ts
   - src/error-formatter.ts

   ## Dependencies
   - @bernierllc/logger (if needed)
   - zod or joi for schema validation

   ## Testing Strategy
   - Unit tests for each validator function
   - Integration tests for schema parsing
   - Target coverage: 90%
   ```

3. **Start Workflow**:

   ```typescript
   import { Connection, Client } from '@temporalio/client';
   import { PackageBuildTurnBasedWorkflow } from '@bernierllc/package-builder-production';
   import type { TurnBasedPackageBuildInput } from '@bernierllc/package-builder-production';

   async function main() {
     const connection = await Connection.connect({
       address: 'localhost:7233'
     });

     const client = new Client({ connection });

     const input: TurnBasedPackageBuildInput = {
       packageName: '@bernierllc/data-validator',
       packagePath: 'packages/core/data-validator',
       planPath: 'plans/packages/core/data-validator.md',
       category: 'core',
       dependencies: [],
       workspaceRoot: process.cwd(),
       config: {
         // ... your config ...
       },
       enableTurnBasedGeneration: true
     };

     const handle = await client.workflow.start(PackageBuildTurnBasedWorkflow, {
       taskQueue: 'package-builder',
       workflowId: `package-build-${Date.now()}`,
       args: [input]
     });

     console.log(`Workflow started: ${handle.workflowId}`);

     const result = await handle.result();
     console.log('Workflow completed:', result);
   }

   main().catch(console.error);
   ```

4. **Monitor Progress**:

   ```bash
   # Watch workflow progress
   temporal workflow describe \
     --workflow-id package-build-1732198765432

   # Monitor state files
   watch -n 2 'ls -lh .generation-state/ && echo && cat .generation-state/gen-*.json | jq ".currentPhase, .currentStepNumber"'

   # Watch git commits
   git log --oneline --decorate --graph -20
   ```

## Configuration

### Feature Flag Options

```typescript
interface BuildConfig {
  // ... other config fields ...

  turnBasedGeneration?: {
    // Enable/disable turn-based generation
    enabled: boolean;

    // Optional: Run only specific phases (useful for testing)
    phasesToExecute?: GenerationPhase[];

    // Optional: Skip specific phases
    phasesToSkip?: GenerationPhase[];

    // Optional: Override token budgets per phase
    tokenBudgets?: Partial<Record<GenerationPhase, number>>;

    // Optional: Override temperature settings per phase
    temperatures?: Partial<Record<GenerationPhase, number>>;
  };
}
```

### Example Configurations

#### Basic Enable

```typescript
const config: BuildConfig = {
  turnBasedGeneration: {
    enabled: true
  }
};
```

#### Test Specific Phases

```typescript
const config: BuildConfig = {
  turnBasedGeneration: {
    enabled: true,
    phasesToExecute: ['PLANNING', 'FOUNDATION', 'TYPES']  // Only run first 3 phases
  }
};
```

#### Custom Token Budgets

```typescript
const config: BuildConfig = {
  turnBasedGeneration: {
    enabled: true,
    tokenBudgets: {
      CORE_IMPLEMENTATION: 10000,  // Increased from 8000
      TESTING: 8000                 // Increased from 6000
    }
  }
};
```

#### Skip Optional Phases

```typescript
const config: BuildConfig = {
  turnBasedGeneration: {
    enabled: true,
    phasesToSkip: ['EXAMPLES', 'INTEGRATION_REVIEW']  // Skip for internal packages
  }
};
```

### Package Category Configuration

Different package categories have different requirements:

| Category | Coverage Target | Typical Phases Needed | Estimated Time |
|----------|----------------|----------------------|----------------|
| core | 90% | All 15 phases | 30-35 min |
| service | 85% | All 15 phases | 25-30 min |
| suite | 80% | All 15 phases | 25-30 min |
| ui | 80% | All 15 phases | 25-30 min |
| validator | 90% | All 15 phases | 30-35 min |
| utility | 85% | Skip EXAMPLES, INTEGRATION_REVIEW | 20-25 min |

### Environment Variables

Optional environment variables for configuration:

```bash
# Claude API
CLAUDE_API_KEY=sk-ant-...
CLAUDE_API_BASE_URL=https://api.anthropic.com

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=package-builder

# Workspace
WORKSPACE_ROOT=/Users/user/projects/repo
GENERATION_STATE_DIR=.generation-state

# Feature flags
ENABLE_TURN_BASED_GENERATION=true
ENABLE_TOKEN_TRACKING=true
```

## Running Workflows

### Start New Workflow

```typescript
const handle = await client.workflow.start(PackageBuildTurnBasedWorkflow, {
  taskQueue: 'package-builder',
  workflowId: `package-build-${Date.now()}`,
  args: [input]
});
```

### Resume from Failure

```typescript
import { loadGenerationState } from '@bernierllc/package-builder-production';

// Load failed session context
const context = await loadGenerationState(
  'gen-1732198765432',
  '/workspace/root'
);

if (context) {
  // Resume with same input, adding context
  const resumeInput: TurnBasedPackageBuildInput = {
    ...originalInput,
    resumeFromContext: context
  };

  const handle = await client.workflow.start(PackageBuildTurnBasedWorkflow, {
    taskQueue: 'package-builder',
    workflowId: `package-build-resume-${Date.now()}`,
    args: [resumeInput]
  });
}
```

### Cancel Workflow

```typescript
const handle = client.workflow.getHandle('package-build-1732198765432');
await handle.cancel();
```

### Query Workflow State

```typescript
const handle = client.workflow.getHandle('package-build-1732198765432');
const description = await handle.describe();
console.log('Status:', description.status);
console.log('Run Time:', description.runTime);
```

## Monitoring Progress

### Real-Time Monitoring

#### Watch State Files

```bash
# Monitor current phase and step
watch -n 2 'cat .generation-state/gen-*.json | jq -r ".sessionId, .currentPhase, .currentStepNumber, .completedSteps | length"'
```

Output:
```
gen-1732198765432
CORE_IMPLEMENTATION
5
4
```

#### Watch Git Commits

```bash
# Show latest commits with decorate
git log --oneline --decorate -10

# Show commits on generation branch
git log --oneline feat/package-generation-1732198765432
```

Output:
```
abc123d feat(types): complete TYPES phase for @bernierllc/data-validator
def456e feat(foundation): complete FOUNDATION phase for @bernierllc/data-validator
ghi789f feat(planning): complete PLANNING phase for @bernierllc/data-validator
```

#### Watch Workflow Logs

```bash
# Temporal CLI
temporal workflow show \
  --workflow-id package-build-1732198765432 \
  --follow

# Or from Temporal UI
open http://localhost:8233
```

### Progress Indicators

#### Completed Steps

Check `context.completedSteps` array:

```bash
cat .generation-state/gen-1732198765432.json | jq '.completedSteps[] | "\(.phase): \(.description)"'
```

Output:
```
"PLANNING: Created package plan and architecture blueprint"
"FOUNDATION: Generated configuration files"
"TYPES: Generated type definitions"
```

#### Files Modified

Track which files each phase created:

```bash
cat .generation-state/gen-1732198765432.json | jq '.completedSteps[] | "\(.phase): \(.files | join(", "))"'
```

Output:
```
"PLANNING: docs/architecture.md, plans/packages/core/data-validator.md"
"FOUNDATION: package.json, tsconfig.json, .eslintrc.json, .gitignore, jest.config.cjs"
"TYPES: src/types/index.ts"
```

#### Time Tracking

Calculate elapsed time per phase:

```bash
cat .generation-state/gen-1732198765432.json | jq '.completedSteps[] | "\(.phase): \((.timestamp / 1000) | strftime("%H:%M:%S"))"'
```

### Dashboards

#### Create Simple Dashboard

```bash
#!/bin/bash
# dashboard.sh - Monitor turn-based generation

SESSION_ID=$1
STATE_FILE=".generation-state/${SESSION_ID}.json"

if [ ! -f "$STATE_FILE" ]; then
  echo "Session not found: $SESSION_ID"
  exit 1
fi

clear
echo "========================================"
echo "Turn-Based Generation Dashboard"
echo "========================================"
echo ""

echo "Session: $(jq -r '.sessionId' $STATE_FILE)"
echo "Package: $(jq -r '.packageName' $STATE_FILE)"
echo "Branch: $(jq -r '.branch' $STATE_FILE)"
echo ""

echo "Current Phase: $(jq -r '.currentPhase' $STATE_FILE)"
echo "Current Step: $(jq -r '.currentStepNumber' $STATE_FILE)"
echo ""

echo "Completed Phases:"
jq -r '.completedSteps[] | "\(.phase)"' $STATE_FILE | sort -u
echo ""

echo "Last Commit: $(jq -r '.lastSuccessfulCommit' $STATE_FILE)"
echo ""

if jq -e '.failureRecovery' $STATE_FILE > /dev/null; then
  echo "FAILURE DETECTED:"
  jq -r '.failureRecovery | "Step: \(.failedStep)\nError: \(.error)\nRetries: \(.retryCount)"' $STATE_FILE
fi
```

Usage:
```bash
./dashboard.sh gen-1732198765432
```

## Recovery Procedures

### Procedure 1: Resume After Workflow Crash

**Symptoms**:
- Temporal workflow shows as terminated/failed
- State file exists with partial progress
- Git commits exist for some phases

**Steps**:

1. **Verify State**:
   ```bash
   ls -lh .generation-state/
   cat .generation-state/gen-*.json | jq '{sessionId, currentPhase, currentStepNumber, lastSuccessfulCommit}'
   ```

2. **Check Git State**:
   ```bash
   git log --oneline -10
   git status
   ```

3. **Load Context**:
   ```typescript
   import { loadGenerationState } from '@bernierllc/package-builder-production';

   const context = await loadGenerationState('gen-1732198765432', process.cwd());
   console.log('Resuming from:', context.currentPhase);
   console.log('Completed steps:', context.completedSteps.length);
   ```

4. **Resume Workflow**:
   ```typescript
   const resumeInput: TurnBasedPackageBuildInput = {
     ...originalInput,
     resumeFromContext: context
   };

   const handle = await client.workflow.start(PackageBuildTurnBasedWorkflow, {
     taskQueue: 'package-builder',
     workflowId: `package-build-resume-${Date.now()}`,
     args: [resumeInput]
   });
   ```

5. **Monitor Resume**:
   ```bash
   temporal workflow show --workflow-id <new-workflow-id> --follow
   ```

### Procedure 2: Fix Phase Failure

**Symptoms**:
- Phase executor throws error
- State file has `failureRecovery` field
- Git commits stop at failed phase

**Steps**:

1. **Identify Failure**:
   ```bash
   cat .generation-state/gen-*.json | jq '.failureRecovery'
   ```

   Output:
   ```json
   {
     "failedStep": 5,
     "error": "TypeError: Cannot read property 'files' of undefined",
     "retryCount": 1
   }
   ```

2. **Analyze Error**:
   - Check error message
   - Review workflow logs
   - Inspect last successful commit

3. **Determine Fix**:

   **Transient Error** (API timeout, network issue):
   - Retry immediately, no code changes needed

   **Bug in Phase Executor**:
   - Fix bug in `phase-executor.activities.ts`
   - Rebuild: `yarn build`
   - Resume workflow

   **Invalid Package Plan**:
   - Update plan file
   - Resume workflow

4. **Apply Fix and Resume**:
   ```bash
   # If code fix needed
   vim src/activities/phase-executor.activities.ts
   yarn build

   # Resume workflow
   node scripts/resume-workflow.ts gen-1732198765432
   ```

### Procedure 3: Resolve Git Conflicts

**Symptoms**:
- Commit fails with conflict error
- State saved but no git commit
- Dirty working directory

**Steps**:

1. **Check Git Status**:
   ```bash
   git status
   git diff
   ```

2. **Resolve Conflict**:
   ```bash
   # Review conflicts
   git status

   # Manually resolve files
   vim <conflicted-files>

   # Stage resolved files
   git add .

   # Commit manually
   git commit -m "feat(<phase>): complete <PHASE> phase for <package-name>

   Files modified: <files>

   [Turn-based generation step <N>] (manual commit after conflict resolution)"
   ```

3. **Update State**:
   ```bash
   # Get commit hash
   COMMIT_HASH=$(git rev-parse HEAD)

   # Update state file (requires jq)
   cat .generation-state/gen-*.json | \
     jq ".lastSuccessfulCommit = \"$COMMIT_HASH\"" > \
     .generation-state/gen-*.json.tmp
   mv .generation-state/gen-*.json.tmp .generation-state/gen-*.json
   ```

4. **Resume Workflow**:
   ```typescript
   // Load updated context and resume
   const context = await loadGenerationState('gen-1732198765432', process.cwd());
   // ... resume as normal
   ```

### Procedure 4: Handle Token Limit Exceeded

**Symptoms**:
- Claude API returns 400 error
- Error message mentions token limit
- Phase consistently fails at same point

**Steps**:

1. **Identify Phase**:
   ```bash
   cat .generation-state/gen-*.json | jq '.failureRecovery'
   ```

2. **Increase Token Budget**:
   ```typescript
   // In phase-executor.activities.ts
   const claudeResponse = await executeAgentWithClaude({
     prompt,
     model: 'claude-sonnet-4-5-20250929',
     temperature: 0.3,
     maxTokens: 10000  // Increased from 8000
   });
   ```

3. **Or Split Phase** (if budget can't increase):
   ```typescript
   // Create two sub-phases
   export async function executeCoreImplementationPhase1(context) { /* ... */ }
   export async function executeCoreImplementationPhase2(context) { /* ... */ }
   ```

4. **Rebuild and Resume**:
   ```bash
   yarn build
   node scripts/resume-workflow.ts gen-1732198765432
   ```

### Recovery Checklist

Before resuming any workflow:

- [ ] State file exists and is valid JSON
- [ ] Git working directory is clean (or conflicts resolved)
- [ ] Last successful commit exists in git log
- [ ] Any code fixes have been applied and rebuilt
- [ ] Failure cause has been identified and addressed
- [ ] Original workflow has been terminated
- [ ] Resume input includes `resumeFromContext`

## Troubleshooting

### Issue: "State file not found"

**Cause**: Session ID incorrect or state file deleted.

**Solution**:
```bash
# List all sessions
ls -lh .generation-state/

# Find session by package name
grep -r "@bernierllc/data-validator" .generation-state/

# Use correct session ID
```

### Issue: "Phase skipped but shouldn't be"

**Cause**: `shouldSkipPhase()` detects phase already completed.

**Solution**:
```bash
# Check completed steps
cat .generation-state/gen-*.json | jq '.completedSteps[] | .phase'

# If incorrect, manually edit state file
vim .generation-state/gen-*.json
# Remove incorrect phase from completedSteps array
```

### Issue: "Git commit fails: dirty working directory"

**Cause**: Uncommitted changes from previous phase.

**Solution**:
```bash
# Review changes
git status
git diff

# Commit manually or reset
git add .
git commit -m "Manual commit before resuming"

# Or reset if safe
git reset --hard HEAD
```

### Issue: "Rate limit exceeded"

**Cause**: Too many API calls in short time.

**Solution**:
```bash
# Wait 1 minute
sleep 60

# Resume workflow (will continue from last saved state)
```

### Issue: "Invalid response format from Claude"

**Cause**: Claude returned unexpected format, parse failed.

**Solution**:
1. Check Claude response in logs
2. Update prompt if needed to clarify expected format
3. Update response parser if format has changed
4. Rebuild and resume

### Issue: "Workflow times out"

**Cause**: Phase taking longer than Temporal timeout.

**Solution**:
```typescript
// Increase timeout in workflow
const { executePhaseX } = proxyActivities<typeof phaseActivities>({
  startToCloseTimeout: '30 minutes'  // Increased from 15 minutes
});
```

### Issue: "Files not being created"

**Cause**: File operations failing silently or paths incorrect.

**Solution**:
1. Check `applyFileChanges` logs
2. Verify `packagePath` is correct in context
3. Check file system permissions
4. Review parsed file operations:
   ```bash
   # Enable debug logging
   DEBUG=package-builder:* node scripts/run-workflow.ts
   ```

### Common Error Messages

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `ENOENT: no such file or directory` | Invalid path in context | Check `workspaceRoot` and `packagePath` |
| `Cannot read property 'files' of undefined` | Parse response failed | Check Claude response format |
| `Git error: fatal: not a git repository` | Not in git repo | Run from repo root |
| `Claude API error: 429 Too Many Requests` | Rate limit hit | Wait 60 seconds, resume |
| `Phase TYPES not implemented yet` | Missing phase executor | Implement executor or update phase list |

## Performance Tuning

### Token Budget Optimization

#### Monitor Actual Usage

Track actual token usage per phase (future enhancement):

```typescript
// In phase executor
const claudeResponse = await executeAgentWithClaude({
  prompt,
  model: 'claude-sonnet-4-5-20250929',
  temperature: 0.3,
  maxTokens: 8000
});

// Log actual usage
console.log(`[Phase] Used ${claudeResponse.usage.input_tokens} input tokens`);
console.log(`[Phase] Used ${claudeResponse.usage.output_tokens} output tokens`);
```

#### Adjust Budgets

If phase consistently uses less than budget:

```typescript
// Reduce budget to speed up (faster response)
maxTokens: 3000  // Was 5000

// Or increase budget for more comprehensive output
maxTokens: 10000  // Was 8000
```

#### Budget Guidelines

- **Minimum**: 2000 tokens (simple barrel files)
- **Standard**: 4000-5000 tokens (most phases)
- **Complex**: 6000-8000 tokens (implementation, testing)
- **Maximum**: 8000 tokens (rate limit constraint)

### Temperature Tuning

#### Purpose of Temperature

- **Low (0.2)**: Consistent, deterministic output (config files, types)
- **Medium (0.3)**: Slightly varied but focused (implementation)
- **High (0.4)**: Creative, varied output (documentation, examples)

#### When to Adjust

**Lower temperature** if:
- Output varies too much between runs
- Need exact format/structure
- Generating config or boilerplate

**Raise temperature** if:
- Output too repetitive
- Need more creative solutions
- Generating documentation or examples

#### Example Adjustments

```typescript
// More deterministic types
temperature: 0.1  // Was 0.2

// More creative documentation
temperature: 0.5  // Was 0.4

// Standard implementation
temperature: 0.3  // Keep as is
```

### Execution Time Optimization

#### Measure Phase Duration

```bash
# Extract timestamps from state file
cat .generation-state/gen-*.json | jq -r '.completedSteps[] | "\(.phase): \(.timestamp)"' | \
  awk 'NR>1 {print $1, ($2-prev)/1000 "s"} {prev=$2}'
```

Output:
```
FOUNDATION: 67s
TYPES: 45s
CORE_IMPLEMENTATION: 187s
```

#### Optimize Slow Phases

If phase takes > 5 minutes:

1. **Reduce prompt complexity**:
   - Remove unnecessary context
   - Simplify instructions
   - Reduce few-shot examples

2. **Split into sub-phases**:
   - Divide work across multiple smaller phases
   - Each completes faster and commits independently

3. **Optimize prompt engineering**:
   - More focused, specific instructions
   - Pre-compute context outside prompt
   - Cache common prompt sections

#### Parallel Execution (Future)

Some phases can run in parallel:

```
FOUNDATION
    ↓
  TYPES
    ↓
┌───────┴────────┐
│                │
UTILITIES  ERROR_HANDLING  (parallel)
│                │
└───────┬────────┘
        ↓
   ENTRY_POINT
```

### Resource Optimization

#### Disk Space

State files grow with each step:

```bash
# Monitor state file sizes
du -sh .generation-state/

# Clean up old sessions
find .generation-state/ -name "*.json" -mtime +7 -delete
```

#### Memory Usage

Reduce memory if running multiple workflows:

```typescript
// In Temporal worker
const worker = await Worker.create({
  workflowsPath: require.resolve('./workflows'),
  maxConcurrentWorkflowTaskExecutions: 2,  // Reduced from default 100
  maxConcurrentActivityTaskExecutions: 4   // Reduced from default 100
});
```

#### Network Optimization

Claude API calls are the bottleneck:

- **Minimize prompt size**: Remove unnecessary context
- **Cache responses**: For identical prompts (future)
- **Reuse connections**: Keep HTTP connections alive

## Best Practices

### Before Starting

1. **Clean workspace**:
   ```bash
   git status  # Should be clean
   git pull    # Get latest changes
   ```

2. **Valid package plan**:
   - Plan file exists and is complete
   - MECE validation criteria met
   - Dependencies listed

3. **Test configuration**:
   ```typescript
   // Validate config before running
   if (!config.turnBasedGeneration?.enabled) {
     throw new Error('Turn-based generation not enabled');
   }
   ```

### During Execution

1. **Monitor regularly**:
   - Check state files every 5 minutes
   - Watch git commits
   - Review Temporal workflow status

2. **Don't interrupt**:
   - Let phases complete fully
   - Don't cancel mid-phase
   - If must cancel, wait for phase to finish

3. **Save workflow ID**:
   ```bash
   echo "package-build-1732198765432" > .current-workflow-id
   ```

### After Completion

1. **Verify output**:
   ```bash
   # Check all files created
   git log --name-only -10

   # Run build and tests
   cd <package-path>
   yarn build
   yarn test
   ```

2. **Review quality**:
   - Read generated code
   - Check test coverage
   - Verify documentation

3. **Clean up**:
   ```bash
   # Archive state file
   mv .generation-state/gen-*.json .generation-state/archive/

   # Merge branch
   git checkout main
   git merge --no-ff feat/package-generation-1732198765432
   ```

### Recommended Workflow

```bash
# 1. Prepare
git checkout main
git pull
git status  # Ensure clean

# 2. Create plan
mkdir -p plans/packages/core
vim plans/packages/core/my-package.md

# 3. Start generation
node scripts/build-package.ts \
  --name @bernierllc/my-package \
  --category core \
  --turn-based

# 4. Monitor (in another terminal)
watch -n 5 './scripts/dashboard.sh gen-<session-id>'

# 5. Wait for completion
# ... workflow runs ...

# 6. Verify
cd packages/core/my-package
yarn build
yarn test

# 7. Review and merge
git checkout main
git merge feat/package-generation-<timestamp>
git push
```

### Tips for Success

1. **Start with simple packages**: Test on small packages before large ones
2. **Review each phase**: Inspect git commits after each phase completes
3. **Keep backups**: State files are critical, back them up regularly
4. **Monitor Claude API usage**: Track tokens to optimize costs
5. **Document customizations**: Note any config changes for team
6. **Test recovery**: Intentionally fail and recover to understand process
7. **Iterate on prompts**: Improve phase prompts based on output quality

### Anti-Patterns to Avoid

1. **Don't**:
   - Modify state files manually (unless recovering)
   - Run multiple workflows for same package simultaneously
   - Cancel workflows mid-phase
   - Delete state files while workflow running
   - Modify generated code before workflow completes

2. **Don't assume**:
   - Phase will succeed on first try
   - Token budgets work for all packages
   - Git commits will always succeed
   - Claude output will be perfect

3. **Do instead**:
   - Let workflow complete or fail gracefully
   - Monitor and adjust budgets as needed
   - Prepare for recovery scenarios
   - Review and refine generated code after completion

---

For architectural details, see [Turn-Based Generation Architecture](../architecture/turn-based-generation.md).

For migration from original workflow, see [Migrating to Turn-Based](./migrating-to-turn-based.md).
