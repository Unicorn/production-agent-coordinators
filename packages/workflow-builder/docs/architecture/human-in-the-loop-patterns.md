# Human-in-the-Loop Patterns

Architecture patterns for workflows that require human interaction.

## Overview

Some workflows need human input during execution. The Workflow Builder supports this through Temporal signals and queries, allowing UIs to interact with running workflows.

## Pattern: Agent Tester Workflow

The Agent Tester demonstrates the human-in-the-loop pattern:

### Architecture

```
UI (Modal)          Temporal Workflow          Agent API
   |                       |                      |
   |-- sendMessage(signal) |                      |
   |<----------------------|                      |
   |                       |-- callAgentActivity -|
   |                       |<---------------------|
   |                       |                      |
   |-- getConversation(query)                     |
   |<----------------------|                      |
```

### Implementation

**Workflow** (`src/lib/agent-tester/workflow.ts`):
- Maintains conversation state in workflow memory
- Registers signal handlers for user input
- Registers query handler for state retrieval
- Calls activities to interact with external APIs

**Signals**:
- `sendMessage`: Receives user messages
- `endTest`: Ends the test session

**Queries**:
- `getConversation`: Returns current conversation state

**Activities**:
- `callAgentActivity`: Calls agent API with conversation
- `saveTestSessionActivity`: Persists session to database

### State Management

Workflow state is durable:
- Conversation array stored in workflow memory
- Survives workflow task failures
- Can be queried at any time
- Persisted to database for analytics

### Token Efficiency

For long conversations:
- Only recent messages sent to agent API
- Older context truncated (last 20 messages)
- Full history maintained in workflow
- Summarization can be added for very long conversations

## Pattern: UI Polling

The UI polls the workflow for updates:

```typescript
// Poll every 2 seconds when active
const { data } = api.agentTester.getConversation.useQuery(
  { workflowId },
  { refetchInterval: isActive ? 2000 : false }
);
```

**Benefits**:
- Simple to implement
- Works with any UI framework
- No WebSocket infrastructure needed

**Trade-offs**:
- Slight delay (up to 2 seconds)
- Polling overhead
- Can be replaced with WebSockets for real-time

## Pattern: Signal-Based Input

User input sent via signals:

```typescript
// UI sends signal
await handle.signal('sendMessage', userInput);

// Workflow receives signal
setHandler(sendMessageSignal, (message: string) => {
  userInput = message;
  lastActivityTime = currentTimeMs();
});
```

**Benefits**:
- Reliable delivery
- Works across network boundaries
- Temporal handles retries

## Pattern: Query-Based State

Workflow state exposed via queries:

```typescript
// UI queries state
const state = await handle.query('getConversation');

// Workflow returns state
setHandler(getConversationQuery, () => ({
  messages: conversation,
  isActive,
}));
```

**Benefits**:
- Read-only access
- No side effects
- Fast and efficient

## Timeout Handling

Workflows can timeout on inactivity:

```typescript
// Wait for signal with timeout
await condition(
  () => userInput !== null || !isActive,
  INACTIVITY_TIMEOUT_MS
);

// Check timeout after wait
if (timeSinceLastActivity > INACTIVITY_TIMEOUT_MS) {
  isActive = false;
}
```

## Error Handling

Graceful error handling:

```typescript
try {
  const response = await callAgentActivity({...});
  conversation.push({ role: 'assistant', content: response });
} catch (error) {
  conversation.push({
    role: 'assistant',
    content: `Error: ${error.message}`
  });
}
```

## Best Practices

### 1. Keep State Minimal

Only store what's needed in workflow state:
- Current conversation
- Active flags
- Timestamps for timeouts

### 2. Use Activities for External Calls

Never call external APIs directly from workflow:
- Use activities for all external calls
- Activities can be retried
- Activities can timeout independently

### 3. Handle Timeouts Gracefully

- Set reasonable timeouts (5 minutes for chat)
- Save state before timeout
- Allow users to resume if needed

### 4. Poll Efficiently

- Poll frequently when active (2 seconds)
- Stop polling when inactive
- Reduce polling rate for long sessions

### 5. Clean Up Resources

- End workflows when done
- Save final state
- Clean up database records

## Related Documentation

- [Temporal Integration](temporal-integration.md) - Workflow execution
- [Advanced Patterns](advanced-patterns.md) - Other workflow patterns
- [System Workflows Setup](../system-workflows-setup.md) - System workflow setup
- [Agent Testing](../user-guide/agent-testing.md) - Using agent tester

