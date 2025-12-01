# Package Builder Integration Plans

This directory contains plans for integrating Claude Code CLI and Gemini CLI into the existing PackageBuilderWorkflow system.

## Current Status

### Implemented CLI Workflows

#### Gemini CLI
- **Location:** `packages/temporal-coordinator/src/workflows.ts`
- **Workflow:** `AuditedBuildWorkflow(specFileContent, requirementsFileContent)`
- **Approach:** Stateless - rewrites `GEMINI.md` each call
- **CLI Command:** `gemini 'prompt...' --yolo -o json`

#### Claude CLI
- **Location:** `packages/temporal-coordinator/src/claude-workflows.ts`
- **Workflows:**
  - `ClaudeAuditedBuildWorkflow(input)` - Full featured
  - `ClaudeSimpleBuildWorkflow(spec, requirements)` - Cost-optimized
  - `ClaudePremiumBuildWorkflow(spec, requirements)` - With Opus architecture
- **Approach:** Stateful - static `CLAUDE.md` + session management
- **CLI Command:** `claude -p 'prompt' --output-format json --permission-mode acceptEdits --model sonnet`

### Key Architectural Differences

| Aspect | Gemini CLI | Claude CLI |
|--------|------------|------------|
| **Context File** | `GEMINI.md` (rewritten each call) | `CLAUDE.md` (written once) |
| **Memory** | Stateless (file is memory) | Stateful (session maintains history) |
| **Multi-step** | Reconstruct context each step | Resume session (remembers previous) |
| **Model Selection** | Single model | Opus/Sonnet/Haiku routing |
| **Extended Thinking** | Not available | `think hard`/`ultrathink` keywords |
| **Cost Optimization** | Fixed per call | Model routing reduces costs |

## Integration Plan

See [`cli-integration-plan.md`](./cli-integration-plan.md) for the complete integration strategy.

### Goals

1. **Abstract CLI Differences**: Create unified interface hiding provider specifics
2. **Preserve Existing Steps**: Keep all PackageBuildWorkflow phases intact
3. **Remove Turn-Based Code**: Eliminate API-specific agent code
4. **Add Fallback**: Gemini first, Claude fallback based on credits
5. **Add Resume**: Detect mid-build state and continue
6. **Optimize Tokens**: Move programmatic steps out of agent calls

### Implementation Phases

1. **Week 1: Foundation**
   - Create CLI abstraction layer
   - Implement provider selection
   - Add resume detection

2. **Week 2: Integration**
   - Replace turn-based code
   - Integrate CLI workflows
   - Optimize token usage

3. **Week 3: Cleanup**
   - Remove obsolete code
   - Audit and optimize
   - Documentation

## Related Documents

- **Gemini CLI Plan**: `../headless-gemini/gemini-cli-integration.md`
- **Claude CLI Plan**: `../headless-claude/claude-cli-integration-plan.md`
- **Package Builder Analysis**: `../../PACKAGE_BUILDER_WORKFLOW_ANALYSIS.md`
- **Update Requirements**: `./update.md`

