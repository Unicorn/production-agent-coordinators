# Next Steps: CLI Integration Enhancements

## Current Status ✅

- ✅ CLI abstraction layer complete
- ✅ All unit tests passing (23/23)
- ✅ Integration with PackageBuildWorkflow complete
- ✅ Resume detection implemented
- ✅ Both CLI tools installed (Gemini 0.17.1, Claude 2.0.55)

## Immediate Next Steps

### 1. Integration Testing (Priority: High)
**Status**: Ready to test (requires Temporal server)

**Prerequisites:**
- [ ] Start Temporal server: `docker-compose up -d temporal`
- [ ] Start worker: `yarn workspace @coordinator/agent-package-builder-production start:worker`
- [ ] Verify CLI tools authenticated

**Test Scenarios:**
- [ ] Basic Gemini CLI execution (scaffold simple package)
- [ ] Basic Claude CLI execution (scaffold simple package)
- [ ] Provider selection (Gemini preferred)
- [ ] Provider fallback (Gemini → Claude on rate limit)
- [ ] Session continuity (Claude multi-step)
- [ ] Resume detection (partial build completion)
- [ ] End-to-end package build (Gemini)
- [ ] End-to-end package build (Claude)
- [ ] Multi-package build with dependencies

### 2. Claude Model Selection (Priority: High)
**Status**: Partially implemented - needs enhancement

**Current State:**
- Basic model parameter exists in `CLIAgentParams`
- No automatic model routing based on task type

**Enhancements Needed:**
- [ ] Implement model selection logic in `selectProvider`:
  - Architecture planning → Opus with `think hard`
  - Scaffolding → Sonnet
  - Implementation → Sonnet
  - Lint fixes → Haiku
  - Type fixes → Haiku
  - Cross-file repairs → Opus with `think`
- [ ] Add extended thinking keywords to prompts
- [ ] Add plan mode for architecture phase
- [ ] Track model usage in audit logs

**Files to Update:**
- `cli-agent.activities.ts` - Add model selection logic
- `package-build.workflow.ts` - Use appropriate models per phase

### 3. Token Optimization (Priority: Medium)
**Status**: Basic implementation - can be improved

**Optimizations:**
- [ ] Move more steps to programmatic (reduce agent calls):
  - Simple package.json generation (template-based)
  - Directory structure creation (programmatic)
  - Basic file scaffolding (templates)
- [ ] Optimize context content:
  - Gemini: Only include relevant sections in GEMINI.md
  - Claude: Keep CLAUDE.md minimal, use prompts for specifics
- [ ] Implement context compression for large specs
- [ ] Cache frequently used context sections

### 4. Advanced Claude Features (Priority: Medium)
**Status**: Not yet implemented

**Features:**
- [ ] Custom subagents (code-reviewer, test-writer)
  - Create `.claude/agents/` definitions
  - Integrate into workflow phases
- [ ] Custom slash commands
  - Create `.claude/commands/` definitions
  - Use in workflow prompts
- [ ] Git worktree parallelization
  - Implement `createWorktree` activity
  - Parallel implementation for large packages
- [ ] Hooks integration
  - Configure `.claude/settings.json`
  - Real-time audit logging

### 5. Cost Tracking & Optimization (Priority: Low)
**Status**: Basic audit logging exists

**Enhancements:**
- [ ] Cost tracking dashboard
  - Parse `audit_trace.jsonl` files
  - Aggregate costs by provider/model
  - Identify expensive operations
- [ ] Prompt optimization analysis
  - Compare prompt variations
  - Measure rework rates
  - Optimize based on data
- [ ] Credit balance checking
  - API calls to check actual balances
  - Proactive fallback before exhaustion

### 6. Session Persistence (Priority: Low)
**Status**: Session IDs captured but not persisted

**Enhancements:**
- [ ] Store Claude session IDs in workflow state
- [ ] Resume sessions across workflow restarts
- [ ] Session expiry handling
- [ ] Session cleanup for completed builds

## Recommended Order

### Phase 1: Testing & Validation (Week 1)
1. Start Temporal and run integration tests
2. Test all scenarios with real CLI tools
3. Fix any issues discovered
4. Validate end-to-end package builds

### Phase 2: Model Selection (Week 2)
1. Implement model routing logic
2. Add extended thinking keywords
3. Add plan mode for architecture
4. Test cost savings

### Phase 3: Optimization (Week 3)
1. Move simple steps to programmatic
2. Optimize context content
3. Implement caching
4. Measure token reduction

### Phase 4: Advanced Features (Week 4+)
1. Custom subagents
2. Git worktree parallelization
3. Cost tracking dashboard
4. Session persistence

## Quick Wins (Can Do Now)

These don't require Temporal server:

1. **Model Selection Logic** - Add routing based on task type
2. **Extended Thinking** - Add keywords to Claude prompts
3. **Context Optimization** - Review and optimize context content
4. **Documentation** - Update README with CLI integration details
5. **Template Generation** - Create templates for simple package.json

## Decision Point

**Option A: Test First** (Recommended)
- Start Temporal server
- Run integration tests
- Validate everything works
- Then add enhancements

**Option B: Enhance First**
- Implement model selection
- Add advanced features
- Then test everything together

**Recommendation**: Option A - Test first to ensure foundation is solid, then enhance.

