# End-to-End Integration Test: Signal Coordination

This document describes the manual integration test for verifying the complete signal coordination flow between Build Workflow and Plans Workflow.

## Test Scenario

Test the complete flow from build workflow requesting a plan to Plans Workflow generating it.

## Prerequisites

1. Temporal server running (localhost:7233)
2. MCP server running (localhost:3355 or configured URL)
3. Worker running (`yarn build:worker && yarn start:worker`)

## Test Steps

### Step 1: Start Plans Workflow Singleton

```bash
npx tsx production/scripts/plans-client.ts
```

**Expected Output:**
- ✅ Plans Workflow started with ID `plans-workflow-singleton`
- Workflow is running and listening for signals
- Can view workflow in Temporal UI at http://localhost:8233

**Verification:**
- Open Temporal UI and confirm workflow is RUNNING
- Workflow ID should be `plans-workflow-singleton`

### Step 2: Trigger Build Workflow for Non-Existent Package

```bash
npx tsx packages/agents/suite-builder-production/src/client.ts github-parser
```

Note: Use a package name that doesn't exist in the workspace but is registered in MCP.

**Expected Flow:**
1. Build workflow starts
2. Discovery phase searches for package
3. Package not found locally
4. `discoverPlanFromDependencyGraph` is called
5. Build workflow signals Plans Workflow with package name
6. Build workflow polls MCP for plan to appear
7. Plans Workflow receives signal and processes request

**Expected Output in Build Workflow:**
```
Package @bernierllc/github-parser not found locally. Attempting plan discovery...
Signaling Plans Workflow for @bernierllc/github-parser...
Polling MCP for plan...
```

**Expected Output in Plans Workflow (check Temporal UI):**
```
📨 Received plan request for @bernierllc/github-parser from suite-builder-github-parser
   Queue position: 1 (priority)
   Queue length: 1

📋 Processing: @bernierllc/github-parser
   Source: workflow-request
   Priority: high
   Remaining in queue: 0

Generating plan for @bernierllc/github-parser...
  Dependencies: [count]
  ✓ Registered plan at [path]
```

### Step 3: Verify Signal Was Sent

**In Temporal UI:**
1. Navigate to Plans Workflow (`plans-workflow-singleton`)
2. Click on "Events" tab
3. Look for "WorkflowSignalReceived" event
4. Verify signal name is `requestPlan`
5. Verify input contains package name and correct priority

**Expected Event:**
```json
{
  "signalName": "requestPlan",
  "input": {
    "packageName": "@bernierllc/github-parser",
    "requestedBy": "suite-builder-github-parser",
    "priority": "high",
    "source": "workflow-request",
    "timestamp": [number]
  }
}
```

### Step 4: Verify Plans Workflow Processed Request

**In Plans Workflow Logs (Temporal UI):**
1. Click on "Query" tab
2. Verify workflow processed the request
3. Look for MCP tool calls to `packages_get_dependencies`
4. Look for MCP tool call to `packages_update` with plan registration

**Expected Activities:**
- Activity: `generatePlanForPackage`
  - Input: `{ packageName, requestedBy }`
  - Status: Completed
- MCP calls should be visible in activity logs

### Step 5: Verify Polling Succeeded

**In Build Workflow Logs:**
```
[pollMcpForPlan] Attempt 1/10 for @bernierllc/github-parser
[pollMcpForPlan] Plan found: /path/to/plan.md
✓ Plan generated at /path/to/plan.md
```

**Verification:**
1. Polling should complete within ~1-2 attempts
2. Plan should be registered in MCP
3. Build workflow should receive plan path

### Step 6: Verify MCP Registration

Query MCP to verify plan was registered:

```bash
curl -X POST http://localhost:3355/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "packages_get",
      "arguments": {
        "id": "@bernierllc/github-parser",
        "include": ["plan_content"]
      }
    },
    "id": 1
  }'
```

**Expected Response:**
```json
{
  "result": {
    "content": [{
      "type": "text",
      "text": {
        "id": "@bernierllc/github-parser",
        "plan_file_path": "/path/to/plan.md",
        "status": "planning",
        ...
      }
    }]
  }
}
```

## Success Criteria

✅ Plans Workflow starts and runs indefinitely
✅ Build workflow detects missing package
✅ Build workflow sends signal to Plans Workflow
✅ Plans Workflow receives signal and queues request
✅ Plans Workflow processes request and calls MCP
✅ Plan is registered in MCP with `packages_update`
✅ Build workflow polling succeeds and receives plan path
✅ No errors or timeouts in either workflow

## Troubleshooting

### Plans Workflow Not Receiving Signals
- Check workflow ID is exactly `plans-workflow-singleton`
- Verify both workflows are on same task queue (`suite-builder`)
- Check Temporal UI for signal events

### Polling Timeout
- Verify MCP server is reachable
- Check Plans Workflow is actually processing requests
- Increase `maxAttempts` in `pollMcpForPlan` if needed

### MCP Errors
- Verify MCP server is running
- Check MCP_SERVER_URL environment variable
- Verify package exists in MCP registry

## Test Coverage

This integration test verifies:
1. ✅ Signal coordination between workflows
2. ✅ Plans Workflow queue management
3. ✅ Priority handling (high priority from build workflow)
4. ✅ MCP integration for plan generation
5. ✅ Polling with exponential backoff
6. ✅ Plan registration in MCP
7. ✅ End-to-end workflow orchestration

## Related Files

- Plans Workflow: `src/workflows/plans.workflow.ts`
- Build Workflow: `src/workflows/suite-builder.workflow.ts`
- Signal Definition: `src/signals/plan-signals.ts`
- Planning Activities: `src/activities/planning.activities.ts`
- Discovery Activities: `src/activities/discovery.activities.ts`
- Plans Client: `production/scripts/plans-client.ts`
