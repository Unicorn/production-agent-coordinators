# Archived Workflows

This directory contains deprecated workflow implementations that have been replaced by CLI agent integration.

## Archived Files

### `gemini-turn-based-agent.workflow.ts`
- **Status**: Deprecated
- **Replaced By**: CLI agent integration in `PackageBuildWorkflow`
- **Reason**: Replaced with Gemini CLI for better reliability and token management
- **Date Archived**: 2025-01-XX

### `turn-based-coding-agent.workflow.ts`
- **Status**: Deprecated
- **Replaced By**: CLI agent integration in `PackageBuildWorkflow`
- **Reason**: Replaced with Claude CLI for better session management and model selection
- **Date Archived**: 2025-01-XX

## Migration Notes

These workflows used direct API calls to Gemini and Claude. They have been replaced by:

1. **CLI Agent Integration**: Uses `gemini` and `claude` CLI tools instead of direct API calls
2. **Unified Interface**: `CLIAgentProvider` abstraction in `cli-agent.activities.ts`
3. **Better Reliability**: CLI tools handle authentication, rate limiting, and context management
4. **Resume Capability**: Better resume detection and continuation support

## If You Need to Reference These

These files are kept for reference only. To use similar functionality:

- Use `PackageBuildWorkflow` which now integrates CLI agents
- See `packages/agents/package-builder-production/src/activities/cli-agent.activities.ts` for the new implementation
- See `plans/package-builder/cli-integration-plan.md` for migration details

