# Kong API Gateway Integration

Auto-generate HTTP endpoints for workflows using Kong API Gateway with hash-based routing for unique, scalable URLs.

## Overview

When users publish workflows, we can automatically:
1. Generate unique hash-based URLs per user/project/workflow
2. Create Kong routes that map directly to workflow signals/queries
3. Provide UI components for configuring endpoints
4. Generate and display API URLs to users
5. Handle authentication, rate limiting, and request/response transformation

## Architecture

```
HTTP Request → Kong Gateway → Next.js API Route → Temporal Workflow
  /api/v1/{hash}/orders          (hash lookup)      Signal/Query Handler
```

### Hash-Based Routing

Each endpoint gets a unique hash derived from:
- User ID
- Project ID  
- Workflow ID
- Endpoint path

This ensures:
- **Uniqueness**: No naming conflicts across users/projects
- **Direct Routing**: Kong maps hash directly to service (minimal lookup)
- **Future-Proof**: Can be replaced with custom domains in SaaS mode

## Environment Configuration

### Local Development (Docker Kong)

```env
# Kong Configuration
KONG_ADMIN_URL=http://localhost:8001
KONG_ADMIN_API_KEY=your-admin-key
KONG_GATEWAY_URL=http://localhost:8000

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3010
WORKFLOW_API_BASE_URL=http://localhost:3010/api/workflows

# Environment
NODE_ENV=development
```

### Ngrok Development

```env
# Kong Configuration (Kong still runs locally)
KONG_ADMIN_URL=http://localhost:8001
KONG_ADMIN_API_KEY=your-admin-key
KONG_GATEWAY_URL=https://your-ngrok-url.ngrok.io

# Application URLs (via ngrok)
NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok.io
WORKFLOW_API_BASE_URL=https://your-ngrok-url.ngrok.io/api/workflows

# Environment
NODE_ENV=development
```

### Production (Domain-Based)

```env
# Kong Configuration
KONG_ADMIN_URL=http://kong-admin.internal:8001
KONG_ADMIN_API_KEY=your-secure-admin-key
KONG_GATEWAY_URL=https://api.yourdomain.com

# Application URLs
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
WORKFLOW_API_BASE_URL=https://api.yourdomain.com/api/workflows

# Environment
NODE_ENV=production
```

## Hash Generation

```typescript
// src/lib/kong/hash-generator.ts
import { createHash } from 'crypto';

export interface HashInput {
  userId: string;
  projectId: string;
  workflowId: string;
  endpointPath: string;
}

/**
 * Generate deterministic hash for endpoint routing
 * Format: {first8chars}-{next8chars} = 16 char hash
 * Example: a3f2b1c4-d5e6f7g8
 */
export function generateEndpointHash(input: HashInput): string {
  const combined = `${input.userId}:${input.projectId}:${input.workflowId}:${input.endpointPath}`;
  const hash = createHash('sha256').update(combined).digest('hex');
  
  // Return 16-char hash (8-8 format for readability)
  return `${hash.substring(0, 8)}-${hash.substring(8, 16)}`;
}

/**
 * Parse hash to extract components (for validation/debugging)
 * Note: Hash is one-way, but we can validate against stored hash
 */
export function validateHash(
  hash: string,
  userId: string,
  projectId: string,
  workflowId: string,
  endpointPath: string
): boolean {
  const expected = generateEndpointHash({ userId, projectId, workflowId, endpointPath });
  return hash === expected;
}
```

## URL Structure

### Format

```
{KONG_GATEWAY_URL}/api/v1/{hash}/{endpoint-path}
```

### Examples

**Local Development:**
```
http://localhost:8000/api/v1/a3f2b1c4-d5e6f7g8/orders
```

**Ngrok:**
```
https://abc123.ngrok.io/api/v1/a3f2b1c4-d5e6f7g8/orders
```

**Production:**
```
https://api.yourdomain.com/api/v1/a3f2b1c4-d5e6f7g8/orders
```

### Future SaaS Custom Domains

When custom domains are enabled:
```
https://api.userdomain.com/orders  (hash removed, custom domain)
```

The hash is still used internally for routing, but the user-facing URL is clean.

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
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Endpoint configuration
  endpoint_path VARCHAR(255) NOT NULL, -- e.g., "/orders" (relative path)
  method VARCHAR(10) NOT NULL, -- GET, POST, PUT, DELETE, PATCH
  description TEXT,
  
  -- Hash-based routing
  route_hash VARCHAR(17) NOT NULL UNIQUE, -- e.g., "a3f2b1c4-d5e6f7g8"
  full_path VARCHAR(500) NOT NULL, -- e.g., "/api/v1/a3f2b1c4-d5e6f7g8/orders"
  
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
  
  UNIQUE(workflow_id, endpoint_path, method)
);

CREATE INDEX idx_workflow_endpoints_workflow ON workflow_endpoints(workflow_id);
CREATE INDEX idx_workflow_endpoints_hash ON workflow_endpoints(route_hash);
CREATE INDEX idx_workflow_endpoints_kong ON workflow_endpoints(kong_route_id);
CREATE INDEX idx_workflow_endpoints_user_project ON workflow_endpoints(user_id, project_id);
```

## Configuration Helper

```typescript
// src/lib/kong/config.ts
export interface KongConfig {
  adminUrl: string;
  adminApiKey?: string;
  gatewayUrl: string;
  appUrl: string;
  apiBaseUrl: string;
  environment: 'development' | 'production';
}

export function getKongConfig(): KongConfig {
  const adminUrl = process.env.KONG_ADMIN_URL || 'http://localhost:8001';
  const adminApiKey = process.env.KONG_ADMIN_API_KEY;
  const gatewayUrl = process.env.KONG_GATEWAY_URL || 'http://localhost:8000';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3010';
  const apiBaseUrl = process.env.WORKFLOW_API_BASE_URL || `${appUrl}/api/workflows`;
  const environment = (process.env.NODE_ENV || 'development') as 'development' | 'production';

  return {
    adminUrl,
    adminApiKey,
    gatewayUrl,
    appUrl,
    apiBaseUrl,
    environment,
  };
}
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
import { generateEndpointHash } from './hash-generator';
import { getKongConfig } from './config';

export async function registerWorkflowEndpoints(
  workflowId: string,
  userId: string,
  projectId: string,
  endpoints: WorkflowEndpoint[]
): Promise<RegisteredEndpoint[]> {
  const config = getKongConfig();
  const kong = new KongClient(config.adminUrl, config.adminApiKey);

  const supabase = getSupabaseClient();
  const { data: workflow } = await supabase
    .from('workflows')
    .select('*, project:projects(*)')
    .eq('id', workflowId)
    .single();

  if (!workflow) {
    throw new Error('Workflow not found');
  }

  // Create or get Kong service for workflow API handler
  const serviceName = `workflow-api-handler`;
  const serviceUrl = `${config.apiBaseUrl}`;
  
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
    // Generate hash for this endpoint
    const routeHash = generateEndpointHash({
      userId,
      projectId,
      workflowId,
      endpointPath: endpoint.endpointPath,
    });

    // Full path with hash: /api/v1/{hash}/{endpoint-path}
    const fullPath = `/api/v1/${routeHash}${endpoint.endpointPath}`;

    // Create Kong route with hash-based path
    const routeName = `wf-${routeHash}-${endpoint.method.toLowerCase()}`;
    const routeId = await kong.createRoute(
      serviceId,
      routeName,
      [fullPath], // Kong routes to this exact path
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
        project_id: projectId,
        user_id: userId,
        endpoint_path: endpoint.endpointPath,
        method: endpoint.method,
        description: endpoint.description,
        route_hash: routeHash,
        full_path: fullPath,
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
      hash: routeHash,
      path: endpoint.endpointPath,
      fullPath,
      method: endpoint.method,
      url: `${config.gatewayUrl}${fullPath}`,
      kongRouteId: routeId,
    });
  }

  return registered;
}
```

## API Route Handler

The handler extracts the hash from the URL path and looks up the endpoint configuration.

```typescript
// app/api/workflows/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTemporalClient } from '@/lib/temporal/connection';
import { getSupabaseClient } from '@/lib/supabase/client';

// Kong routes to: /api/workflows/api/v1/{hash}/{endpoint-path}
// We need to extract: hash and endpoint-path
const PATH_PREFIX = '/api/v1/';
const HASH_REGEX = /^\/api\/v1\/([a-f0-9]{8}-[a-f0-9]{8})\/(.+)$/;

export async function GET(req: NextRequest) {
  return handleEndpoint(req, 'GET');
}

export async function POST(req: NextRequest) {
  return handleEndpoint(req, 'POST');
}

export async function PUT(req: NextRequest) {
  return handleEndpoint(req, 'PUT');
}

export async function DELETE(req: NextRequest) {
  return handleEndpoint(req, 'DELETE');
}

async function handleEndpoint(req: NextRequest, method: string) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Extract hash and endpoint path from URL
  // Format: /api/v1/{hash}/{endpoint-path}
  const match = pathname.match(HASH_REGEX);
  if (!match) {
    return NextResponse.json(
      { error: 'Invalid endpoint path format' },
      { status: 400 }
    );
  }

  const [, routeHash, endpointPath] = match;
  const fullEndpointPath = `/${endpointPath}`;

  // Look up endpoint by hash (indexed, fast lookup)
  const supabase = getSupabaseClient();
  const { data: endpoint } = await supabase
    .from('workflow_endpoints')
    .select('*, workflow:workflows(*, project:projects(*))')
    .eq('route_hash', routeHash)
    .eq('endpoint_path', fullEndpointPath)
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
    try {
      const body = await req.json();
      const valid = validateSchema(body, endpoint.request_schema);
      if (!valid) {
        return NextResponse.json(
          { error: 'Invalid request body' },
          { status: 400 }
        );
      }
    } catch {
      // No body or invalid JSON
    }
  }

  const client = await getTemporalClient();
  const workflow = endpoint.workflow;
  const project = workflow.project;

  // Handle different target types
  if (endpoint.target_type === 'start') {
    // Start new workflow execution
    const body = await req.json().catch(() => ({}));
    const executionId = `${workflow.kebab_name}-${Date.now()}`;
    const handle = await client.workflow.start(workflow.kebab_name, {
      taskQueue: project.task_queue_name,
      workflowId: executionId,
      args: [body],
    });

    return NextResponse.json({
      executionId,
      runId: handle.firstExecutionRunId,
      status: 'started',
    });
  } else if (endpoint.target_type === 'signal') {
    // Send signal to running workflow
    const workflowExecutionId = req.headers.get('X-Workflow-Execution-Id');
    if (!workflowExecutionId) {
      return NextResponse.json(
        { error: 'X-Workflow-Execution-Id header required for signals' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const handle = client.workflow.getHandle(workflowExecutionId);
    await handle.signal(endpoint.target_name, body);

    return NextResponse.json({ success: true });
  } else if (endpoint.target_type === 'query') {
    // Query workflow state
    const workflowExecutionId = req.headers.get('X-Workflow-Execution-Id');
    if (!workflowExecutionId) {
      return NextResponse.json(
        { error: 'X-Workflow-Execution-Id header required for queries' },
        { status: 400 }
      );
    }

    const handle = client.workflow.getHandle(workflowExecutionId);
    const result = await handle.query(endpoint.target_name);

    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: 'Invalid target type' },
    { status: 400 }
  );
}
```

### Hash-Based Lookup Benefits

1. **Fast**: Hash is indexed in database
2. **Unique**: No conflicts across users/projects
3. **Direct**: Kong routes directly to handler
4. **Scalable**: Can add caching layer if needed
5. **Future-Proof**: Hash can be replaced with custom domain mapping

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
2. **Configure Endpoint**: User sets path (e.g., `/orders`), method, target (signal/query/start)
3. **Publish Workflow**: On deploy, system:
   - Generates unique hash for endpoint
   - Creates Kong route: `/api/v1/{hash}/orders`
   - Registers endpoint in database
4. **View URLs**: User sees generated API URLs:
   ```
   ✅ Workflow published!
   
   API Endpoints:
   POST https://api.yourdomain.com/api/v1/a3f2b1c4-d5e6f7g8/orders
   ```
5. **Use APIs**: User can call endpoints with provided URLs

## Future: Custom Domain Support

When SaaS custom domains are enabled:

1. User configures custom domain: `api.userdomain.com`
2. System creates DNS mapping: `api.userdomain.com` → Kong Gateway
3. Kong route updated to accept custom domain
4. User-facing URL becomes: `https://api.userdomain.com/orders` (hash removed)
5. Internal routing still uses hash for lookup
6. Database stores both: `route_hash` and `custom_domain`

This allows:
- Clean, branded URLs for users
- No breaking changes to internal routing
- Easy migration path

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

