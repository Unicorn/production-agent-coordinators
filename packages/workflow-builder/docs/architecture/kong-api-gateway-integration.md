# Kong API Gateway Integration

Auto-generate HTTP endpoints for workflows using Kong API Gateway.

## Overview

When users publish workflows, we can automatically:
1. Create Kong routes that map HTTP endpoints to workflow signals/queries
2. Provide UI components for configuring endpoints
3. Generate and display API URLs to users
4. Handle authentication, rate limiting, and request/response transformation

## Architecture

```
HTTP Request → Kong Gateway → Next.js API Route → Temporal Workflow
                                    ↓
                            Signal/Query Handler
```

### Components

1. **Kong Admin API Client** - Register routes/services
2. **Workflow Endpoint Component** - UI component for configuring endpoints
3. **Endpoint Registration Service** - Creates Kong routes on publish
4. **API Route Handler** - Next.js routes that proxy to workflows

## Database Schema

### `workflow_endpoints` Table

```sql
CREATE TABLE workflow_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  
  -- Endpoint configuration
  path VARCHAR(255) NOT NULL, -- e.g., "/api/v1/orders"
  method VARCHAR(10) NOT NULL, -- GET, POST, PUT, DELETE, PATCH
  description TEXT,
  
  -- Workflow mapping
  target_type VARCHAR(50) NOT NULL, -- 'signal', 'query', 'start'
  target_name VARCHAR(255) NOT NULL, -- Signal/query name or 'start'
  
  -- Kong configuration
  kong_route_id VARCHAR(255), -- Kong route ID
  kong_service_id VARCHAR(255), -- Kong service ID
  kong_route_name VARCHAR(255), -- Kong route name
  
  -- Authentication
  auth_type VARCHAR(50) DEFAULT 'api-key', -- 'api-key', 'jwt', 'none'
  auth_config JSONB DEFAULT '{}',
  
  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_hour INTEGER DEFAULT 1000,
  
  -- Request/response transformation
  request_schema JSONB, -- JSON schema for request validation
  response_schema JSONB, -- JSON schema for response
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(workflow_id, path, method)
);

CREATE INDEX idx_workflow_endpoints_workflow ON workflow_endpoints(workflow_id);
CREATE INDEX idx_workflow_endpoints_kong ON workflow_endpoints(kong_route_id);
```

## Kong Integration Service

### Kong Client

```typescript
// src/lib/kong/client.ts
export class KongClient {
  private adminUrl: string;
  private apiKey?: string;

  constructor(adminUrl: string, apiKey?: string) {
    this.adminUrl = adminUrl;
    this.apiKey = apiKey;
  }

  async createService(name: string, url: string): Promise<string> {
    const response = await fetch(`${this.adminUrl}/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Kong-Admin-Token': this.apiKey }),
      },
      body: JSON.stringify({
        name,
        url,
        protocol: 'http',
        host: new URL(url).hostname,
        port: parseInt(new URL(url).port) || 80,
        path: new URL(url).pathname,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create Kong service: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  async createRoute(
    serviceId: string,
    name: string,
    paths: string[],
    methods: string[]
  ): Promise<string> {
    const response = await fetch(`${this.adminUrl}/services/${serviceId}/routes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Kong-Admin-Token': this.apiKey }),
      },
      body: JSON.stringify({
        name,
        paths,
        methods,
        strip_path: false,
        preserve_host: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create Kong route: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  async enablePlugin(
    routeId: string,
    pluginName: string,
    config: Record<string, any>
  ): Promise<void> {
    const response = await fetch(`${this.adminUrl}/routes/${routeId}/plugins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Kong-Admin-Token': this.apiKey }),
      },
      body: JSON.stringify({
        name: pluginName,
        config,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to enable plugin: ${response.statusText}`);
    }
  }

  async deleteRoute(routeId: string): Promise<void> {
    const response = await fetch(`${this.adminUrl}/routes/${routeId}`, {
      method: 'DELETE',
      headers: {
        ...(this.apiKey && { 'Kong-Admin-Token': this.apiKey }),
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete Kong route: ${response.statusText}`);
    }
  }
}
```

## Endpoint Registration Service

```typescript
// src/lib/kong/endpoint-registry.ts
export async function registerWorkflowEndpoints(
  workflowId: string,
  endpoints: WorkflowEndpoint[]
): Promise<RegisteredEndpoint[]> {
  const kong = new KongClient(
    process.env.KONG_ADMIN_URL!,
    process.env.KONG_ADMIN_API_KEY
  );

  const supabase = getSupabaseClient();
  const { data: workflow } = await supabase
    .from('workflows')
    .select('*, project:projects(*)')
    .eq('id', workflowId)
    .single();

  if (!workflow) {
    throw new Error('Workflow not found');
  }

  // Create or get Kong service for this workflow
  const serviceName = `workflow-${workflow.kebab_name}`;
  const serviceUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/workflows/${workflowId}`;
  
  let serviceId: string;
  try {
    serviceId = await kong.createService(serviceName, serviceUrl);
  } catch (error) {
    // Service might already exist, try to get it
    const existing = await getKongService(serviceName);
    serviceId = existing.id;
  }

  const registered: RegisteredEndpoint[] = [];

  for (const endpoint of endpoints) {
    // Create Kong route
    const routeName = `${serviceName}-${endpoint.method.toLowerCase()}-${endpoint.path.replace(/\//g, '-')}`;
    const routeId = await kong.createRoute(
      serviceId,
      routeName,
      [endpoint.path],
      [endpoint.method]
    );

    // Enable rate limiting plugin
    if (endpoint.rateLimitPerMinute) {
      await kong.enablePlugin(routeId, 'rate-limiting', {
        minute: endpoint.rateLimitPerMinute,
        hour: endpoint.rateLimitPerHour || endpoint.rateLimitPerMinute * 60,
      });
    }

    // Enable API key authentication
    if (endpoint.authType === 'api-key') {
      await kong.enablePlugin(routeId, 'key-auth', {
        key_names: ['X-API-Key'],
        hide_credentials: true,
      });
    }

    // Store endpoint in database
    const { data: endpointRecord } = await supabase
      .from('workflow_endpoints')
      .insert({
        workflow_id: workflowId,
        path: endpoint.path,
        method: endpoint.method,
        description: endpoint.description,
        target_type: endpoint.targetType,
        target_name: endpoint.targetName,
        kong_route_id: routeId,
        kong_service_id: serviceId,
        kong_route_name: routeName,
        auth_type: endpoint.authType,
        auth_config: endpoint.authConfig || {},
        rate_limit_per_minute: endpoint.rateLimitPerMinute,
        rate_limit_per_hour: endpoint.rateLimitPerHour,
        request_schema: endpoint.requestSchema,
        response_schema: endpoint.responseSchema,
      })
      .select()
      .single();

    registered.push({
      id: endpointRecord.id,
      path: endpoint.path,
      method: endpoint.method,
      url: `${process.env.KONG_GATEWAY_URL}${endpoint.path}`,
      kongRouteId: routeId,
    });
  }

  return registered;
}
```

## API Route Handler

```typescript
// app/api/workflows/[id]/endpoints/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTemporalClient } from '@/lib/temporal/connection';
import { getSupabaseClient } from '@/lib/supabase/client';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; path: string[] } }
) {
  return handleEndpoint(req, params, 'GET');
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; path: string[] } }
) {
  return handleEndpoint(req, params, 'POST');
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; path: string[] } }
) {
  return handleEndpoint(req, params, 'PUT');
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; path: string[] } }
) {
  return handleEndpoint(req, params, 'DELETE');
}

async function handleEndpoint(
  req: NextRequest,
  params: { id: string; path: string[] },
  method: string
) {
  const supabase = getSupabaseClient();
  const path = `/${params.path.join('/')}`;

  // Find endpoint configuration
  const { data: endpoint } = await supabase
    .from('workflow_endpoints')
    .select('*')
    .eq('workflow_id', params.id)
    .eq('path', path)
    .eq('method', method)
    .eq('is_active', true)
    .single();

  if (!endpoint) {
    return NextResponse.json(
      { error: 'Endpoint not found' },
      { status: 404 }
    );
  }

  // Validate request schema if provided
  if (endpoint.request_schema) {
    const body = await req.json();
    const valid = validateSchema(body, endpoint.request_schema);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
  }

  const client = await getTemporalClient();

  // Handle different target types
  if (endpoint.target_type === 'start') {
    // Start new workflow execution
    const body = await req.json();
    const workflowId = `${endpoint.workflow_id}-${Date.now()}`;
    const handle = await client.workflow.start(endpoint.workflow_id, {
      taskQueue: endpoint.workflow.project.task_queue_name,
      workflowId,
      args: [body],
    });

    return NextResponse.json({
      executionId: workflowId,
      runId: handle.firstExecutionRunId,
      status: 'started',
    });
  } else if (endpoint.target_type === 'signal') {
    // Send signal to running workflow
    const workflowId = req.headers.get('X-Workflow-Id');
    if (!workflowId) {
      return NextResponse.json(
        { error: 'X-Workflow-Id header required' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const handle = client.workflow.getHandle(workflowId);
    await handle.signal(endpoint.target_name, body);

    return NextResponse.json({ success: true });
  } else if (endpoint.target_type === 'query') {
    // Query workflow state
    const workflowId = req.headers.get('X-Workflow-Id');
    if (!workflowId) {
      return NextResponse.json(
        { error: 'X-Workflow-Id header required' },
        { status: 400 }
      );
    }

    const handle = client.workflow.getHandle(workflowId);
    const result = await handle.query(endpoint.target_name);

    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: 'Invalid target type' },
    { status: 400 }
  );
}
```

## UI Component: API Endpoint Node

```typescript
// src/components/workflow/nodes/ApiEndpointNode.tsx
export function ApiEndpointNode({ data, selected }: NodeProps) {
  return (
    <Handle type="target" position={Position.Top} />
    <div className={`api-endpoint-node ${selected ? 'selected' : ''}`}>
      <div className="node-header">
        <Icon name="api" />
        <span>{data.label || 'API Endpoint'}</span>
      </div>
      <div className="node-body">
        <div className="endpoint-info">
          <span className="method">{data.config?.method || 'GET'}</span>
          <span className="path">{data.config?.path || '/api/...'}</span>
        </div>
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} />
  );
}
```

## Endpoint Configuration Panel

```typescript
// src/components/workflow/EndpointConfigPanel.tsx
export function EndpointConfigPanel({ endpoint, onChange }: Props) {
  return (
    <YStack gap="$4">
      <FormField label="HTTP Method">
        <Select
          value={endpoint.method}
          onValueChange={(value) => onChange({ ...endpoint, method: value })}
        >
          <Select.Item value="GET">GET</Select.Item>
          <Select.Item value="POST">POST</Select.Item>
          <Select.Item value="PUT">PUT</Select.Item>
          <Select.Item value="DELETE">DELETE</Select.Item>
        </Select>
      </FormField>

      <FormField label="Path">
        <Input
          value={endpoint.path}
          onChangeText={(text) => onChange({ ...endpoint, path: text })}
          placeholder="/api/v1/orders"
        />
      </FormField>

      <FormField label="Target Type">
        <Select
          value={endpoint.targetType}
          onValueChange={(value) => onChange({ ...endpoint, targetType: value })}
        >
          <Select.Item value="start">Start Workflow</Select.Item>
          <Select.Item value="signal">Send Signal</Select.Item>
          <Select.Item value="query">Query State</Select.Item>
        </Select>
      </FormField>

      {endpoint.targetType === 'signal' && (
        <FormField label="Signal Name">
          <Select
            value={endpoint.targetName}
            onValueChange={(value) => onChange({ ...endpoint, targetName: value })}
          >
            {/* Populate from workflow signals */}
          </Select>
        </FormField>
      )}

      <FormField label="Authentication">
        <Select
          value={endpoint.authType}
          onValueChange={(value) => onChange({ ...endpoint, authType: value })}
        >
          <Select.Item value="none">None</Select.Item>
          <Select.Item value="api-key">API Key</Select.Item>
          <Select.Item value="jwt">JWT</Select.Item>
        </Select>
      </FormField>

      <FormField label="Rate Limit (per minute)">
        <Input
          type="number"
          value={endpoint.rateLimitPerMinute}
          onChangeText={(text) =>
            onChange({ ...endpoint, rateLimitPerMinute: parseInt(text) })
          }
        />
      </FormField>
    </YStack>
  );
}
```

## Deploy Flow Integration

```typescript
// src/server/api/routers/workflows.ts - Update deploy procedure
deploy: protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // ... existing deploy logic ...

    // Get workflow endpoints from nodes
    const { data: endpointNodes } = await ctx.supabase
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_id', input.id)
      .eq('node_type', 'api-endpoint');

    if (endpointNodes && endpointNodes.length > 0) {
      // Register endpoints with Kong
      const endpoints = endpointNodes.map(node => ({
        path: node.config.path,
        method: node.config.method,
        targetType: node.config.targetType,
        targetName: node.config.targetName,
        authType: node.config.authType || 'api-key',
        rateLimitPerMinute: node.config.rateLimitPerMinute || 60,
      }));

      const registered = await registerWorkflowEndpoints(input.id, endpoints);

      // Store registered endpoints
      // Return URLs to user
      return {
        success: true,
        workflow: updated,
        endpoints: registered.map(e => ({
          method: e.method,
          path: e.path,
          url: e.url,
        })),
      };
    }

    return { success: true, workflow: updated };
  }),
```

## User Experience

1. **Add Endpoint Component**: User drags "API Endpoint" component onto canvas
2. **Configure Endpoint**: User sets path, method, target (signal/query/start)
3. **Publish Workflow**: On deploy, endpoints are registered with Kong
4. **View URLs**: User sees generated API URLs in success message
5. **Use APIs**: User can call endpoints with provided URLs

## Benefits

- **Automatic**: No manual API route creation
- **Scalable**: Kong handles routing, rate limiting, auth
- **Visual**: Configure endpoints in workflow builder
- **Type-safe**: Request/response schemas for validation
- **Secure**: Built-in authentication and rate limiting

## Related Documentation

- [Workflow APIs](../user-guide/workflow-apis.md) - Manual API creation
- [Deploying Workflows](../user-guide/deploying-workflows.md) - Deploy process
- [Signals and Queries](../architecture/advanced-patterns.md) - Workflow communication

