# Provider-Agnostic vs Claude-Specific Components

## Summary

Most of the infrastructure we built is **provider-agnostic** and works with both Gemini and Claude CLIs. However, the **workflows** we created are Claude-specific because they use Claude-specific activities.

---

## ✅ Provider-Agnostic Components (Work with Both Gemini & Claude)

### 1. Git Activities
**File:** `packages/agents/package-builder-production/src/activities/git.activities.ts`

**Header Comment:**
> "Git Operations Activities - Provider-Agnostic"
> "These activities handle git operations (commit, push, PR creation) and work
> regardless of whether Gemini or Claude CLI is being used."

**Functions:**
- `gitCommit` - Works with any provider
- `gitPush` - Works with any provider
- `gitCreateBranch` - Works with any provider
- `gitCreatePR` - Works with any provider
- `createWorktree` - Works with any provider
- `mergeWorktrees` - Works with any provider
- `cleanupWorktrees` - Works with any provider

**Usage:** Can be called from any workflow (Gemini or Claude)

---

### 2. Credential Activities
**File:** `packages/agents/package-builder-production/src/activities/credentials.activities.ts`

**Functions:**
- `checkGitHubCLI` - Works with any provider
- `checkNPM` - Works with any provider
- `checkPackagesAPI` - Works with any provider
- `checkGit` - Works with any provider
- `checkClaudeCLI` - Checks Claude CLI (but function is provider-agnostic)
- `checkGeminiCLI` - Checks Gemini CLI (but function is provider-agnostic)
- `checkCredentials` - Checks both providers

**Usage:** Can be called from any workflow to validate credentials

---

### 3. Optimization Activities
**Files:**
- `optimization-ab-testing.activities.ts`
- `optimization-tuning.activities.ts`
- `optimization-subagent.activities.ts`

**Status:** Provider-agnostic - these analyze results from any workflow execution

**Usage:** Can analyze results from Gemini or Claude workflows

---

### 4. CLI Abstraction Layer
**File:** `packages/agents/package-builder-production/src/activities/cli-agent.activities.ts`

**Purpose:** Unified interface for both Gemini and Claude CLIs

**Features:**
- Provider abstraction (`CLIProviderName = 'gemini' | 'claude'`)
- Automatic fallback on errors
- Credit/rate limit checking
- Unified result format

**Usage:** Workflows can use this to work with either provider

---

## 🔵 Claude-Specific Components

### 1. Claude Workflows
**Files:**
- `packages/temporal-coordinator/src/claude-workflows.ts`
- `packages/temporal-coordinator/src/claude-parallel-workflow.ts`

**Why Claude-Specific:**
- Use `executeClaudeAgent` (Claude-specific activity)
- Use `setupClaudeWorkspace` (writes `CLAUDE.md`)
- Use `runClaudeComplianceChecks` (Claude-specific)
- Use Claude session management (`--resume <session_id>`)
- Use Claude model selection (`--model opus/sonnet/haiku`)

**Workflows:**
- `ClaudeAuditedBuildWorkflow`
- `ClaudeSimpleBuildWorkflow`
- `ClaudePremiumBuildWorkflow`
- `ParallelBuildWorkflow` (uses Claude activities)

---

### 2. Claude Activities
**File:** `packages/temporal-coordinator/src/claude-activities.ts`

**Functions:**
- `executeClaudeAgent` - Claude CLI specific
- `setupClaudeWorkspace` - Creates `CLAUDE.md` (Claude-specific)
- `runClaudeComplianceChecks` - Claude-specific
- `logClaudeAuditEntry` - Claude-specific

**Why Claude-Specific:**
- Uses Claude CLI commands (`claude -p ...`)
- Manages Claude sessions
- Uses Claude model flags
- Uses Claude-specific output format

---

### 3. Claude Configuration
**Files:**
- `packages/agents/package-builder-production/.claude/` directory
  - `agents/` - Custom subagents (Claude-specific)
  - `commands/` - Custom commands (Claude-specific)
  - `settings.json` - Claude CLI settings
  - `scripts/` - Hook scripts (Claude-specific)

**Why Claude-Specific:**
- These are Claude Code CLI features
- Gemini CLI doesn't have subagents, custom commands, or hooks

---

## 🔄 What Could Be Used by Gemini Workflows

### Already Provider-Agnostic (Ready to Use)

1. **Git Activities** ✅
   - Gemini workflows can call `gitCommit`, `gitPush`, `gitCreatePR`
   - Gemini workflows can use `createWorktree`, `mergeWorktrees`, `cleanupWorktrees`

2. **Credential Activities** ✅
   - Gemini workflows can call `checkCredentials` to validate setup

3. **Optimization Activities** ✅
   - Gemini workflows can use A/B testing, thinking level tuning, subagent optimization
   - (Note: Some features like "thinking levels" are Claude-specific, but the framework is generic)

4. **CLI Abstraction Layer** ✅
   - Gemini workflows can use `CLIAgentProvider` interface
   - Automatic provider selection and fallback

---

## 📋 What Would Need Gemini Equivalents

### To Create Gemini Parallel Workflow

**Would Need:**
1. Gemini equivalent of `executeClaudeAgent` → `executeGeminiAgent` (already exists in `cli-agent.activities.ts`)
2. Gemini equivalent of `setupClaudeWorkspace` → `setupGeminiWorkspace` (would write `GEMINI.md` instead of `CLAUDE.md`)
3. Gemini workflow using git worktrees (same pattern, different agent activity)

**Could Reuse:**
- ✅ All git activities (worktree, commit, push, PR)
- ✅ Credential checks
- ✅ Optimization framework
- ✅ Compliance checks (generic)

**Example Gemini Parallel Workflow:**
```typescript
// Would use:
import { executeGeminiAgent } from './gemini-activities'; // Gemini-specific
import { createWorktree, mergeWorktrees } from './git.activities'; // Provider-agnostic ✅
import { checkCredentials } from './credentials.activities'; // Provider-agnostic ✅
```

---

## Summary Table

| Component | Provider-Agnostic? | Used By |
|-----------|-------------------|---------|
| **Git Activities** | ✅ Yes | Both Gemini & Claude |
| **Credential Activities** | ✅ Yes | Both Gemini & Claude |
| **Optimization Activities** | ✅ Yes | Both Gemini & Claude |
| **CLI Abstraction Layer** | ✅ Yes | Both Gemini & Claude |
| **Claude Workflows** | ❌ No | Claude only |
| **Claude Activities** | ❌ No | Claude only |
| **Claude Config (.claude/)** | ❌ No | Claude only |
| **Git Worktree Pattern** | ✅ Yes | Can be used by both |

---

## Key Insight

**The infrastructure is mostly provider-agnostic!** The git worktrees, credential checks, and optimization framework can all be used by Gemini workflows. Only the specific workflow implementations and Claude CLI activities are Claude-specific.

**To create Gemini equivalents:**
1. Use existing provider-agnostic activities (git, credentials, optimization)
2. Create Gemini-specific activities (similar to `claude-activities.ts`)
3. Create Gemini workflows (similar to `claude-workflows.ts`) that use:
   - Gemini-specific activities for agent execution
   - Provider-agnostic activities for git, credentials, etc.

---

## Recommendation

The work we did provides:
- ✅ **Reusable infrastructure** (git, credentials, optimization) - works with both
- 🔵 **Claude-specific workflows** - ready to use for Claude
- 📋 **Pattern for Gemini** - same patterns can be applied to create Gemini equivalents

The parallelization pattern (git worktrees) is especially valuable because it's completely provider-agnostic and can be used by any workflow that needs true parallelism.

