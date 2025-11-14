# MCP vs REST API Architecture Decision

**Date:** 2025-11-14
**Status:** Architectural Note
**Context:** Plan Writer Service Refactor

## Decision Context

During the plan-writer-service refactor, we identified that activities (code) should call REST APIs directly, while agents should use MCP tools.

## Principle

**Agents = MCP Tools** (for decision-making with context)
- Agents use MCP tools to gather context and make decisions
- MCP provides rich context and tool capabilities
- Appropriate for creative/analytical work

**Activities = REST API** (for programmatic operations)
- Direct HTTP calls to packages-api
- Simple fetch/update operations
- No decision-making or context needed
- More efficient for simple CRUD operations

## Examples

### Agent Uses MCP
```typescript
// Agent prompt has access to MCP tools
spawnPackageEvaluatorAgent({
  // Agent uses mcp__packages-api__packages_get internally
  // Agent uses mcp__packages-api__packages_get_dependencies
  // Agent makes decision based on rich context
})
```

### Activity Uses REST API
```typescript
// Direct HTTP call in activity
async function queryPackageDetails(packageId: string) {
  const response = await fetch(`${PACKAGES_API_URL}/packages/${packageId}`);
  return response.json();
}
```

## Current Implementation

**For now (Phase 2):** Use existing MCP code in activities to avoid breaking changes
- Activities will call MCP-wrapped functions
- This keeps things working while we refactor architecture
- TODO: Migrate to direct REST calls in future phase

## Future Migration

**Phase N (Future):**
1. Create REST API client library
2. Replace MCP calls in activities with REST calls
3. Keep MCP tools for agents only
4. Update activity implementations incrementally

## Benefits of Future Migration

- **Performance:** Direct API calls faster than MCP wrapper
- **Simplicity:** Activities don't need MCP client overhead
- **Separation of Concerns:** Clear boundary between agent context (MCP) and code operations (REST)
- **Type Safety:** REST client can provide full TypeScript types

## Notes

- Both MCP and REST hit the same packages-api backend
- No functionality difference, only interface difference
- This is an optimization, not a requirement
- Current MCP approach works fine for now

---

**Action:** Document this decision, continue with MCP for now, plan REST migration for later phase.
