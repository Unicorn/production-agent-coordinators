# Package Builder CLI Integration Plan

## Status: ✅ Implementation Complete, ⏸️ Integration Testing In Progress

**Last Updated**: 2025-12-01

## Overview

This plan outlines the integration of Claude Code CLI and Gemini CLI workflows into the existing PackageBuilderWorkflow system. The goal is to abstract away CLI/model specifics while preserving all existing package building capabilities, removing turn-based API code, and adding intelligent fallback and resume capabilities.

**Current Status**:
- ✅ Core implementation: 100% complete
- ✅ Unit tests: 23/23 passing
- ✅ Enhancements: Model selection, fix agent replacement complete
- ⏸️ Integration tests: Written but blocked on Temporal setup
- 📋 See `CURRENT_STATUS.md` for detailed status

## Current State Analysis

### Existing Workflows

#### 1. PackageBuilderWorkflow (Orchestrator)
**Location:** `packages/agents/package-builder-production/src/workflows/package-builder.workflow.ts`

**Current Phases:**
- **INITIALIZE**: Parse plan/audit report, build dependency graph
- **PLAN**: Verify package plans, validate npm publish status
- **BUILD**: Spawn child PackageBuildWorkflow for each package (dependency-aware)
- **VERIFY**: Validate dependency tree publish status
- **COMPLETE**: Generate build reports

**Key Activities:**
- `buildDependencyGraph` - Parse JSON audit report or use AI to extract dependencies
- `parsePlanFileWithAgent` - Uses Claude AI to extract dependencies from plan
- `validateDependencyTreePublishStatus` - Check npm for published packages
- Spawns `PackageBuildWorkflow` child workflows

#### 2. PackageBuildWorkflow (Per-Package)
**Location:** `packages/agents/package-builder-production/src/workflows/package-build.workflow.ts`

**Current Phases:**
- **PRE-FLIGHT VALIDATION**: Check package state, npm status, audit completion
- **SCAFFOLDING**: Generate package structure (currently uses GeminiTurnBasedAgentWorkflow)
- **BUILD**: Compile TypeScript
- **TEST**: Run test suite
- **QUALITY**: Check code standards
- **PUBLISH**: Publish to npm
- **GIT**: Commit and push changes

**Key Activities:**
- `checkPackageExists` - Verify package directory exists
- `checkNpmPublished` - Check npm registry
- `checkIfUpgradePlan` - Detect upgrade vs initial implementation
- `auditPackageState` - Analyze completion percentage
- `verifyDependencies` - Ensure dependencies are published
- `GeminiTurnBasedAgentWorkflow` - Current code generation (TO BE REPLACED)
- `runBuild`, `runTests`, `runQualityChecks` - Validation steps
- `publishPackage`, `commitChanges`, `pushChanges` - Publishing steps

#### 3. Gemini CLI Workflow (New)
**Location:** `packages/temporal-coordinator/src/workflows.ts`

**Workflow:** `AuditedBuildWorkflow(specFileContent, requirementsFileContent)`

**Approach:**
- Rewrites `GEMINI.md` each call with full context
- CLI: `gemini 'prompt...' --yolo -o json`
- Stateless execution (context in file)

**Phases:**
1. Setup workspace
2. Context injection (write GEMINI.md)
3. Scaffolding
4. Implementation
5. Verification loop (compliance checks + repair)

#### 4. Claude CLI Workflow (New)
**Location:** `packages/temporal-coordinator/src/claude-workflows.ts`

**Workflows:**
- `ClaudeAuditedBuildWorkflow(input)` - Full featured with options
- `ClaudeSimpleBuildWorkflow(spec, requirements)` - Cost-optimized (Sonnet only)
- `ClaudePremiumBuildWorkflow(spec, requirements)` - With Opus architecture planning

**Approach:**
- Static `CLAUDE.md` written once
- Session management via `--resume <session_id>`
- CLI: `claude -p 'prompt' --output-format json --permission-mode acceptEdits --model sonnet`
- Stateful execution (context in session)

**Phases:**
1. Setup workspace (write CLAUDE.md once)
2. Optional: Architecture planning (Opus with extended thinking)
3. Scaffolding (new session or continue from planning)
4. Implementation (resume session)
5. Verification loop (compliance checks + repair with model routing)

### Key Architectural Differences

| Aspect | Gemini CLI | Claude CLI |
|--------|------------|------------|
| **Context Management** | Rewrite `GEMINI.md` each call | Static `CLAUDE.md` + session resume |
| **Conversation Memory** | Stateless - file IS the memory | Stateful - CLI maintains session history |
| **Multi-step Workflows** | Each step reconstructs context | Resume session; context persists |
| **Repair Context** | Error log embedded in `GEMINI.md` | Error log in prompt; session provides code context |
| **Model Selection** | Single model | Opus/Sonnet/Haiku routing |
| **Extended Thinking** | Not available | `think hard`/`ultrathink` keywords |
| **Cost Optimization** | Fixed cost per call | Model routing reduces costs |

## Integration Strategy

### Phase 1: Abstract CLI Interface

Create a unified interface that abstracts away CLI-specific details:

```typescript
// packages/agents/package-builder-production/src/activities/cli-agent.activities.ts

export interface CLIAgentProvider {
  name: 'gemini' | 'claude';
  executeAgent(params: CLIAgentParams): Promise<CLIAgentResult>;
  setupWorkspace(params: WorkspaceSetupParams): Promise<string>;
  runComplianceChecks(workingDir: string): Promise<ComplianceResult>;
  logAuditEntry(workingDir: string, entry: AuditEntry): Promise<void>;
}

export interface CLIAgentParams {
  instruction: string;
  workingDir: string;
  contextContent?: string;  // For Gemini (GEMINI.md content)
  sessionId?: string;       // For Claude (session resume)
  model?: string;           // For Claude (opus/sonnet/haiku)
  allowedTools?: string[];  // For Claude
  permissionMode?: string;  // For Claude
}

export interface CLIAgentResult {
  success: boolean;
  result: string;
  cost_usd: number;
  duration_ms: number;
  session_id?: string;      // For Claude
  error?: string;
}
```

### Phase 2: Provider Selection Logic

Implement intelligent provider selection based on:
- Credit availability
- Rate limiting status
- Task complexity
- Cost optimization

```typescript
export interface ProviderSelectionStrategy {
  selectProvider(
    task: BuildTask,
    creditStatus: CreditStatus
  ): CLIAgentProvider;
  
  shouldFallback(
    currentProvider: CLIAgentProvider,
    error: Error
  ): boolean;
}
```

### Phase 3: Unified Build Workflow

Create a new unified workflow that:
- Uses the abstracted CLI interface
- Preserves all existing PackageBuildWorkflow steps
- Adds resume capability
- Optimizes token usage

## Implementation Plan

### Step 1: Create CLI Abstraction Layer

**Location:** `packages/agents/package-builder-production/src/activities/cli-agent.activities.ts`

**Tasks:**
- [ ] Define `CLIAgentProvider` interface
- [ ] Implement `GeminiCLIProvider` (wraps existing Gemini activities)
- [ ] Implement `ClaudeCLIProvider` (wraps existing Claude activities)
- [ ] Create `ProviderFactory` for selecting providers
- [ ] Add credit/rate limit checking logic
- [ ] Implement fallback mechanism

**Files to Create:**
- `src/activities/cli-agent.activities.ts` - Main abstraction
- `src/activities/providers/gemini-provider.ts` - Gemini implementation
- `src/activities/providers/claude-provider.ts` - Claude implementation
- `src/activities/providers/provider-factory.ts` - Provider selection

**Files to Modify:**
- `packages/temporal-coordinator/src/activities.ts` - Extract Gemini activities
- `packages/temporal-coordinator/src/claude-activities.ts` - Extract Claude activities

### Step 2: Remove Turn-Based Code

**Files to Remove:**
- `packages/agents/package-builder-production/src/workflows/gemini-turn-based-agent.workflow.ts`
- `packages/agents/package-builder-production/src/workflows/turn-based-coding-agent.workflow.ts`
- `packages/agents/package-builder-production/src/activities/gemini-agent.activities.ts` (API-specific code)
- Any other turn-based workflow files

**Files to Clean:**
- `packages/agents/package-builder-production/src/workflows/package-build.workflow.ts`
  - Remove `GeminiTurnBasedAgentWorkflow` import
  - Remove turn-based agent invocation
  - Replace with CLI-based agent call

### Step 3: Integrate CLI Workflows into PackageBuildWorkflow

**Location:** `packages/agents/package-builder-production/src/workflows/package-build.workflow.ts`

**Changes:**
- [ ] Replace `GeminiTurnBasedAgentWorkflow` with unified CLI agent activity
- [ ] Add provider selection logic (Gemini first, Claude fallback)
- [ ] Preserve all existing phases:
  - PRE-FLIGHT VALIDATION
  - SCAFFOLDING (now via CLI)
  - BUILD
  - TEST
  - QUALITY
  - PUBLISH
  - GIT
- [ ] Add resume detection logic
- [ ] Integrate audit logging

**Key Integration Points:**

```typescript
// Replace this:
const geminiInput: GeminiTurnBasedAgentInput = { ... };
await executeChild(GeminiTurnBasedAgentWorkflow, geminiInput);

// With this:
const cliProvider = await selectCLIProvider({
  task: 'scaffold',
  creditStatus: await checkCredits(),
  preferredProvider: 'gemini'
});

const result = await cliProvider.executeAgent({
  instruction: buildScaffoldInstruction(input, packageAuditContext),
  workingDir: input.packagePath,
  contextContent: buildContextContent(input),
  // ... provider-specific params
});
```

### Step 4: Add Resume Capability

**Location:** `packages/agents/package-builder-production/src/activities/resume-detector.activities.ts`

**Tasks:**
- [ ] Create `detectResumePoint` activity
- [ ] Compare current file state against plan
- [ ] Identify completed vs incomplete steps
- [ ] Generate resume context for CLI agent

**Resume Detection Logic:**
1. Read plan file to extract required files/steps
2. Check which files exist and their completion status
3. Compare against plan requirements
4. Generate resume instruction for CLI agent
5. For Claude: Resume existing session if available
6. For Gemini: Include resume context in GEMINI.md

### Step 5: Optimize Token Usage

**Programmatic Steps (No Agent Required):**
- [ ] Dependency checking (already programmatic via npm registry)
- [ ] File existence checks (already programmatic)
- [ ] Package.json generation (can be templated for simple cases)
- [ ] Directory structure creation (programmatic)
- [ ] Git operations (programmatic)

**Agent Steps (Require CLI):**
- [ ] Complex scaffolding (when templates insufficient)
- [ ] Source code generation
- [ ] Test generation
- [ ] Documentation generation
- [ ] Error fixing

**Optimization Strategy:**
1. Do programmatic steps first (reduce agent context)
2. Only call agent for code generation
3. Use targeted prompts (not full context dumps)
4. For Claude: Leverage session continuity
5. For Gemini: Minimize GEMINI.md size

### Step 6: Preserve Existing PackageBuilderWorkflow Steps

**Ensure All Steps Are Maintained:**

#### PackageBuilderWorkflow (Orchestrator)
- [x] INITIALIZE: Parse plan/audit report ✓
- [x] PLAN: Validate npm publish status ✓
- [x] BUILD: Spawn child workflows ✓
- [x] VERIFY: Validate dependency tree ✓
- [x] COMPLETE: Generate reports ✓

#### PackageBuildWorkflow (Per-Package)
- [x] PRE-FLIGHT VALIDATION ✓
- [ ] SCAFFOLDING (replace with CLI)
- [x] BUILD ✓
- [x] TEST ✓
- [x] QUALITY ✓
- [x] PUBLISH ✓
- [x] GIT ✓

### Step 7: Add Fallback Logic

**Location:** `packages/agents/package-builder-production/src/activities/provider-factory.ts`

**Fallback Scenarios:**
1. **Credit Exhaustion**: Switch from Gemini to Claude
2. **Rate Limiting**: Switch provider and retry
3. **CLI Failure**: Retry with different provider
4. **Session Expiry** (Claude): Start fresh session with context reconstruction

**Implementation:**
```typescript
export async function executeWithFallback(
  task: BuildTask,
  preferredProvider: CLIAgentProvider
): Promise<CLIAgentResult> {
  let currentProvider = preferredProvider;
  let attempts = 0;
  const maxAttempts = 2;
  
  while (attempts < maxAttempts) {
    try {
      const result = await currentProvider.executeAgent(task);
      return result;
    } catch (error) {
      if (shouldFallback(error, currentProvider)) {
        currentProvider = getFallbackProvider(currentProvider);
        attempts++;
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('All providers exhausted');
}
```

### Step 8: Testing Strategy

**Unit Tests:**
- [ ] CLI provider abstraction
- [ ] Provider selection logic
- [ ] Fallback mechanism
- [ ] Resume detection

**Integration Tests:**
- [ ] End-to-end package build with Gemini CLI
- [ ] End-to-end package build with Claude CLI
- [ ] Fallback from Gemini to Claude
- [ ] Resume mid-build scenario
- [ ] Dependency-aware multi-package build

**Test Files:**
- `src/__tests__/cli-agent.activities.test.ts`
- `src/__tests__/provider-factory.test.ts`
- `src/__tests__/resume-detector.activities.test.ts`
- `src/__tests__/package-build-cli.workflow.test.ts`

## File Structure

```
packages/agents/package-builder-production/
├── src/
│   ├── activities/
│   │   ├── cli-agent.activities.ts          # NEW: Main abstraction
│   │   ├── providers/
│   │   │   ├── gemini-provider.ts           # NEW: Gemini CLI wrapper
│   │   │   ├── claude-provider.ts           # NEW: Claude CLI wrapper
│   │   │   └── provider-factory.ts          # NEW: Selection & fallback
│   │   ├── resume-detector.activities.ts    # NEW: Resume detection
│   │   ├── build.activities.ts               # EXISTING: Keep
│   │   ├── agent.activities.ts               # MODIFY: Remove API code
│   │   └── ...
│   ├── workflows/
│   │   ├── package-builder.workflow.ts        # EXISTING: Keep as-is
│   │   ├── package-build.workflow.ts         # MODIFY: Replace turn-based with CLI
│   │   ├── gemini-turn-based-agent.workflow.ts  # DELETE: No longer needed
│   │   └── turn-based-coding-agent.workflow.ts  # DELETE: No longer needed
│   └── ...
```

## Migration Order

### Week 1: Foundation
1. **Day 1-2**: Create CLI abstraction layer
   - Define interfaces
   - Implement Gemini provider (wrap existing activities)
   - Implement Claude provider (wrap existing activities)
   - Unit tests

2. **Day 3-4**: Provider selection and fallback
   - Implement ProviderFactory
   - Add credit checking
   - Add fallback logic
   - Unit tests

3. **Day 5**: Resume detection
   - Implement resume detector activity
   - Test resume scenarios
   - Integration with CLI providers

### Week 2: Integration
4. **Day 1-2**: Replace turn-based code in PackageBuildWorkflow
   - Remove GeminiTurnBasedAgentWorkflow calls
   - Add CLI agent calls
   - Preserve all existing phases
   - Integration tests

5. **Day 3-4**: Optimize token usage
   - Identify programmatic steps
   - Move to activities (no agent)
   - Optimize prompts
   - Measure token reduction

6. **Day 5**: End-to-end testing
   - Test single package build
   - Test multi-package build
   - Test fallback scenarios
   - Test resume scenarios

### Week 3: Cleanup & Polish
7. **Day 1-2**: Remove obsolete code
   - Delete turn-based workflows
   - Remove API-specific code
   - Clean up imports
   - Update documentation

8. **Day 3-4**: Audit and optimization
   - Review audit logs
   - Optimize prompts based on data
   - Tune provider selection
   - Performance testing

9. **Day 5**: Documentation and handoff
   - Update architecture docs
   - Write migration guide
   - Document provider selection
   - Document resume capability

## Key Design Decisions

### 1. Abstraction Level
**Decision:** Abstract at the activity level, not workflow level.

**Rationale:**
- Workflows remain simple and readable
- Easy to swap providers
- Testable in isolation
- Preserves existing workflow structure

### 2. Context Management
**Decision:** Handle context differences in provider implementations.

**Rationale:**
- Gemini: Provider writes GEMINI.md each call
- Claude: Provider writes CLAUDE.md once, manages sessions
- Workflow doesn't need to know the difference

### 3. Resume Strategy
**Decision:** Resume detection happens before CLI call, context passed to provider.

**Rationale:**
- Works for both providers
- Gemini: Resume context in GEMINI.md
- Claude: Resume context in prompt, session provides code context

### 4. Fallback Strategy
**Decision:** Automatic fallback on credit/rate limit errors, manual retry on other errors.

**Rationale:**
- Transparent to workflow
- Preserves existing retry logic
- Clear error boundaries

### 5. Model Selection (Claude)
**Decision:** Provider handles model selection based on task type.

**Rationale:**
- Workflow doesn't need to know about models
- Provider can optimize costs
- Easy to tune selection logic

## Success Criteria

### Functional Requirements
- [ ] All existing PackageBuildWorkflow steps preserved
- [ ] Dependency checking works
- [ ] NPM publish status checking works
- [ ] Multi-package builds work
- [ ] Resume mid-build works
- [ ] Fallback between providers works

### Performance Requirements
- [ ] Token usage reduced by 30%+ (via programmatic steps)
- [ ] Build time comparable or better
- [ ] Cost per package reduced (via model routing for Claude)

### Quality Requirements
- [ ] All existing tests pass
- [ ] New tests cover CLI integration
- [ ] No regressions in package quality
- [ ] Audit logging works for both providers

## Risks and Mitigations

### Risk 1: CLI Behavior Differences
**Mitigation:** Comprehensive integration tests, provider abstraction hides differences

### Risk 2: Session Management Complexity (Claude)
**Mitigation:** Encapsulate in provider, handle session expiry gracefully

### Risk 3: Resume Detection Accuracy
**Mitigation:** Start with simple file-based detection, iterate based on real scenarios

### Risk 4: Fallback Logic Edge Cases
**Mitigation:** Extensive error scenario testing, clear fallback boundaries

### Risk 5: Token Optimization Not Effective
**Mitigation:** Measure before/after, iterate on prompt optimization

## Next Steps

1. **Review this plan** with team
2. **Create GitHub issues** for each step
3. **Set up feature branch** for integration work
4. **Begin Week 1 implementation**

## References

- Gemini CLI Integration: `plans/headless-gemini/gemini-cli-integration.md`
- Claude CLI Integration: `plans/headless-claude/claude-cli-integration-plan.md`
- Package Builder Analysis: `PACKAGE_BUILDER_WORKFLOW_ANALYSIS.md`
- Current Workflows: `packages/agents/package-builder-production/src/workflows/`

