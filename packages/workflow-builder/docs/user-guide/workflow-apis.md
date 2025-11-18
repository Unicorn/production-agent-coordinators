# Creating APIs with Workflows

How to expose workflows as HTTP APIs, pass data in/out, and integrate with external systems.

## Overview

Workflows can be exposed as HTTP APIs in several ways:
1. **Via tRPC** - Type-safe API calls from frontend
2. **Via Next.js API Routes** - REST endpoints for external systems
3. **Via Signals & Queries** - Real-time interaction for human-in-the-loop
4. **Via Activities** - Call external APIs from within workflows

## Pattern 1: Exposing Workflows via tRPC

The simplest way to trigger workflows is through the existing tRPC API.

### Starting a Workflow

```typescript
// Frontend code
const result = await api.execution.build.mutate({
  workflowId: 'your-workflow-id',
  input: {
    userId: '123',
    data: { /* your data */ }
  }
});

// Returns: { executionId, workflowId, runId }
```

### Getting Workflow Results

```typescript
// Poll for results
const status = await api.execution.getStatus.query({
  executionId: result.executionId
});

// status.result contains workflow output
```

### Example: API Endpoint Wrapper

Create a Next.js API route that wraps tRPC:

```typescript
// app/api/workflows/[id]/execute/route.ts
import { appRouter } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/trpc';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const context = await createTRPCContext({ headers: req.headers });
  
  const caller = appRouter.createCaller(context);
  const result = await caller.execution.build({
    workflowId: params.id,
    input: body.input,
  });
  
  return Response.json(result);
}
```

## Pattern 2: Creating REST API Endpoints

Create custom Next.js API routes for your workflows.

### Basic REST Endpoint

```typescript
// app/api/workflows/[id]/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTemporalClient } from '@/lib/temporal/connection';
import { getSupabaseClient } from '@/lib/supabase/client';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authenticate request (API key, JWT, etc.)
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey || !validateApiKey(apiKey)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // 2. Get workflow from database
    const supabase = getSupabaseClient();
    const { data: workflow } = await supabase
      .from('workflows')
      .select('*, project:projects(*)')
      .eq('id', params.id)
      .single();
    
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }
    
    // 3. Parse input from request body
    const input = await req.json();
    
    // 4. Start workflow execution
    const client = await getTemporalClient();
    const workflowId = `${workflow.kebab_name}-${Date.now()}`;
    const handle = await client.workflow.start(
      workflow.kebab_name,
      {
        taskQueue: workflow.project.task_queue_name,
        workflowId,
        args: [input],
      }
    );
    
    // 5. Return execution info
    return NextResponse.json({
      executionId: workflowId,
      runId: handle.firstExecutionRunId,
      status: 'running',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

### Getting Workflow Status

```typescript
// app/api/workflows/[id]/status/[executionId]/route.ts
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; executionId: string } }
) {
  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(params.executionId);
  
  try {
    // Get workflow result (waits if still running)
    const result = await handle.result();
    
    return NextResponse.json({
      status: 'completed',
      result,
    });
  } catch (error) {
    // Check if workflow is still running
    const description = await handle.describe();
    
    return NextResponse.json({
      status: description.status.name.toLowerCase(),
      workflowId: description.workflowId,
      runId: description.runId,
    });
  }
}
```

## Pattern 3: Passing Data Into Workflows

Workflows receive input as the first argument.

### Workflow Input Structure

When you start a workflow, the input is passed as `args[0]`:

```typescript
// In your compiled workflow
export async function myWorkflowWorkflow(input: {
  userId: string;
  orderId: string;
  items: Array<{ id: string; quantity: number }>;
}): Promise<{ orderTotal: number; status: string }> {
  // Use input.userId, input.orderId, etc.
  const total = input.items.reduce((sum, item) => sum + item.quantity * 10, 0);
  
  return {
    orderTotal: total,
    status: 'processed',
  };
}
```

### Starting with Input

```typescript
// Via tRPC
await api.execution.build.mutate({
  workflowId: 'my-workflow',
  input: {
    userId: 'user-123',
    orderId: 'order-456',
    items: [
      { id: 'item-1', quantity: 2 },
      { id: 'item-2', quantity: 1 },
    ],
  },
});

// Via REST API
await fetch('/api/workflows/my-workflow/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    orderId: 'order-456',
    items: [/* ... */],
  }),
});
```

## Pattern 4: Getting Data Out of Workflows

Workflows return data that can be retrieved via queries or by waiting for completion.

### Return Value

The workflow's return value is the output:

```typescript
// In workflow
export async function myWorkflowWorkflow(input: any): Promise<MyOutput> {
  // ... workflow logic ...
  return {
    success: true,
    data: processedData,
    metadata: { processedAt: new Date() },
  };
}
```

### Getting Results

**Option 1: Wait for Completion**

```typescript
const client = await getTemporalClient();
const handle = client.workflow.getHandle(workflowId);

// Wait for workflow to complete
const result = await handle.result();
// result contains the return value
```

**Option 2: Poll Status**

```typescript
// Via tRPC
const status = await api.execution.getStatus.query({ executionId });
if (status.status === 'completed') {
  const output = status.result; // Workflow return value
}
```

**Option 3: Use Queries (Real-time)**

If your workflow exposes a query, you can get state at any time:

```typescript
// In workflow - expose query
setHandler(getStateQuery, () => ({
  currentStep: currentStep,
  processedItems: processedItems,
  result: partialResult,
}));

// From client
const handle = client.workflow.getHandle(workflowId);
const state = await handle.query('getState');
// Get current state without waiting for completion
```

## Pattern 5: Human-in-the-Loop via UI

Use signals and queries for interactive workflows. See [Human-in-the-Loop Patterns](../architecture/human-in-the-loop-patterns.md) for details.

### Signals (Send Data to Workflow)

```typescript
// In workflow
import { defineSignal, setHandler } from '@temporalio/workflow';

export const userApprovalSignal = defineSignal<[boolean]>('userApproval');

setHandler(userApprovalSignal, (approved: boolean) => {
  userDecision = approved;
});

// From UI
const handle = client.workflow.getHandle(workflowId);
await handle.signal('userApproval', true);
```

### Queries (Get Data from Workflow)

```typescript
// In workflow
import { defineQuery, setHandler } from '@temporalio/workflow';

export const getStatusQuery = defineQuery<{ step: string; progress: number }>('getStatus');

setHandler(getStatusQuery, () => ({
  step: currentStep,
  progress: itemsProcessed / totalItems,
}));

// From UI (poll every 2 seconds)
const status = await handle.query('getStatus');
```

## Pattern 6: Calling External APIs from Workflows

Use activities to call external APIs. Activities are the only place where you can make HTTP requests.

### Creating an Activity

```typescript
// activities/call-external-api.ts
export async function callExternalApiActivity(input: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; data: any }> {
  const response = await fetch(input.url, {
    method: input.method,
    headers: {
      'Content-Type': 'application/json',
      ...input.headers,
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
  
  const data = await response.json();
  
  return {
    status: response.status,
    data,
  };
}
```

### Using Activity in Workflow

```typescript
// In compiled workflow
import { proxyActivities } from '@temporalio/workflow';
import * as activities from '../activities';

const { callExternalApiActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export async function myWorkflowWorkflow(input: any) {
  // Call external API
  const result = await callExternalApiActivity({
    url: 'https://api.example.com/data',
    method: 'POST',
    body: { userId: input.userId },
  });
  
  // Use result in workflow
  return {
    externalData: result.data,
  };
}
```

### Using Built-in Fetch Activity

The system includes a `fetch-api-data` component you can use:

1. Add "Fetch API Data" activity to your workflow
2. Configure:
   - **URL**: `https://api.example.com/endpoint`
   - **Method**: `POST`
   - **Headers**: `{ "Authorization": "Bearer token" }`
   - **Body**: `{ "data": "value" }`
3. The activity returns the API response

## Pattern 7: Webhook Integration

Receive webhooks and trigger workflows.

### Webhook Endpoint

```typescript
// app/api/webhooks/[workflowId]/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  // Verify webhook signature (if needed)
  const signature = req.headers.get('X-Webhook-Signature');
  if (!verifySignature(signature, await req.text())) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  // Parse webhook payload
  const payload = await req.json();
  
  // Start workflow with webhook data
  const client = await getTemporalClient();
  const { data: workflow } = await getWorkflow(params.workflowId);
  
  await client.workflow.start(workflow.kebab_name, {
    taskQueue: workflow.project.task_queue_name,
    workflowId: `webhook-${Date.now()}`,
    args: [payload], // Pass webhook payload as input
  });
  
  return NextResponse.json({ received: true });
}
```

## Pattern 8: API Authentication

Secure your workflow APIs.

### API Key Authentication

```typescript
// middleware/api-auth.ts
export function validateApiKey(apiKey: string): boolean {
  // Check against database or environment variable
  const validKeys = process.env.API_KEYS?.split(',') || [];
  return validKeys.includes(apiKey);
}

// In API route
const apiKey = req.headers.get('X-API-Key');
if (!apiKey || !validateApiKey(apiKey)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### JWT Authentication

```typescript
import { verify } from 'jsonwebtoken';

export function validateJWT(token: string) {
  try {
    const decoded = verify(token, process.env.JWT_SECRET!);
    return decoded;
  } catch {
    return null;
  }
}
```

## Best Practices

### 1. Input Validation

Always validate workflow input:

```typescript
import { z } from 'zod';

const WorkflowInputSchema = z.object({
  userId: z.string().uuid(),
  orderId: z.string(),
  items: z.array(z.object({
    id: z.string(),
    quantity: z.number().positive(),
  })),
});

// In API route
const input = WorkflowInputSchema.parse(await req.json());
```

### 2. Error Handling

Handle errors gracefully:

```typescript
try {
  const result = await startWorkflow(input);
  return NextResponse.json(result);
} catch (error) {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}
```

### 3. Rate Limiting

Implement rate limiting for public APIs:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});

const { success } = await ratelimit.limit(apiKey);
if (!success) {
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
}
```

### 4. Async Processing

For long-running workflows, return immediately and poll for results:

```typescript
// Start workflow
const { executionId } = await startWorkflow(input);

// Return execution ID immediately
return NextResponse.json({
  executionId,
  statusUrl: `/api/workflows/${workflowId}/status/${executionId}`,
});
```

### 5. Webhook Callbacks

Send webhooks when workflows complete:

```typescript
// In workflow activity
export async function sendWebhookActivity(url: string, data: any) {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
```

## Related Documentation

- [Executing Workflows](executing-workflows.md) - How workflows run
- [Human-in-the-Loop Patterns](../architecture/human-in-the-loop-patterns.md) - Signals and queries
- [Custom Activities](custom-activities.md) - Creating activities
- [tRPC API Reference](../api/trpc-routers.md#execution-router-execution) - Execution API
- [Temporal Integration](../architecture/temporal-integration.md) - Workflow execution

