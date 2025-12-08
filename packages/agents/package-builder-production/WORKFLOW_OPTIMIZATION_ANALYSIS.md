# Workflow Optimization Analysis - Latest Run

## Cost Improvement
- **Previous run**: $9.50
- **Latest run**: $4.40
- **Improvement**: 53.7% reduction! 🎉

## Issues Found

### 1. Resume Workflow Bug (CRITICAL) ✅ FIXED
**Problem**: Resume workflow creates a NEW workflow with "resume" in the name instead of resuming the original workflow.

**Impact**: 
- Two workflows running simultaneously on the same package
- Duplicate work = duplicate costs
- Workflows: `test-e2e-claude--test-simple-package` and `test-resume-claude--test-simple-package`

**Root Cause**: Test file creates new workflow ID with "resume" prefix:
```typescript
const workflowId = `test-resume-claude-${input.packageName.replace(/[^a-z0-9-]/gi, '-')}`;
```

**Fix**: Use the SAME workflow ID as the original workflow. Temporal will automatically resume the existing workflow if it's still running or has partial state.

```typescript
const originalWorkflowId = `test-e2e-claude-${input.packageName.replace(/[^a-z0-9-]/gi, '-')}`;
const workflowId = originalWorkflowId; // Use same ID to resume, not create new workflow
```

### 2. Duplicate Activity Requests ✅ FIXED
**Problem**: Same activity requests executed multiple times (e.g., `npm install` 4x, `read_file package.json` 2x).

**Impact**: 
- Wasted CLI calls ($0.10-0.15 each)
- Duplicate work

**Fix**: Added caching/deduplication for activity requests:
- Cache key: `${activity.type}:${JSON.stringify(activity.args)}`
- Check cache before executing
- Cache successful results for reuse

**Locations Fixed**:
- Scaffold phase: `taskBreakdown.activities` (breakdown-level)
- Scaffold phase: `task.activity_requests` (per-task)
- Implement phase: `implementTaskBreakdown.activities` (breakdown-level)
- Implement phase: `task.activity_requests` (per-task)

### 3. Things We Could Do Programmatically (Future Optimizations)

#### A. Run `npm install` Programmatically
**Current**: Agent requests `npm install` via `run_cmd` activity
**Proposed**: Run `npm install` programmatically before agent starts (if `node_modules` doesn't exist)
**Savings**: ~$0.10-0.15 per workflow

#### B. Cache File Reads (`package.json`, `tsconfig.json`)
**Current**: Agent requests `read_file` for `package.json` and `tsconfig.json` multiple times
**Proposed**: Read these files programmatically once at workflow start, cache results, pass to agent in context
**Savings**: ~$0.10-0.30 per workflow (depending on duplicates)

#### C. Run `get_git_status` and `list_dir` Programmatically
**Current**: Agent requests these via activities
**Proposed**: Run programmatically, pass results to agent in context
**Savings**: ~$0.10-0.20 per workflow

#### D. Run `npm run build` Programmatically
**Current**: Agent requests `npm run build` via `run_cmd` activity
**Proposed**: Run programmatically via `runBuild` activity (already exists!)
**Savings**: ~$0.10-0.15 per workflow

## Summary of Changes

### ✅ Completed
1. **Resume Workflow Bug Fix**: Use same workflow ID instead of creating new one
2. **Activity Request Deduplication**: Cache results to avoid duplicate CLI calls
3. **Test/Lint Filtering**: Filter test/lint from agent requests, run programmatically

### 🔄 In Progress
1. **Simple Package Detection**: Limit iterative planning for simple packages
2. **Deterministic Workflow IDs**: Prevent duplicate workflows on test retries

### 📋 Future Optimizations
1. Run `npm install` programmatically before agent starts
2. Cache `package.json` and `tsconfig.json` reads
3. Run `get_git_status` and `list_dir` programmatically
4. Run `npm run build` programmatically (use existing `runBuild` activity)

## Expected Cost Reduction

With all optimizations:
- **Current**: $4.40 per run
- **Target**: $2.00-2.50 per run (50-75% additional reduction)
- **Total reduction from original**: 75-85% (from $9.50 to $2.00-2.50)
