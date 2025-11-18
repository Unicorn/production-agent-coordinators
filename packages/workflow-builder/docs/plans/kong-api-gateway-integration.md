# Kong API Gateway Integration Plan

## Overview

Integrate Kong API Gateway to automatically generate HTTP endpoints for workflows when users publish them. This allows users to expose their workflows as REST APIs without writing any code.

## Goals

1. **Auto-generate API endpoints** when workflows are published
2. **Visual configuration** of endpoints in the workflow builder
3. **Kong integration** for routing, authentication, and rate limiting
4. **URL generation** and display to users after publish

## Implementation Phases

### Phase 1: Database Schema

- [ ] Create `workflow_endpoints` table migration
- [ ] Add indexes for performance
- [ ] Add RLS policies

### Phase 2: Kong Client Library

- [ ] Create Kong Admin API client
- [ ] Implement service creation
- [ ] Implement route creation
- [ ] Implement plugin management (rate limiting, auth)
- [ ] Add error handling and retries

### Phase 3: Endpoint Component

- [ ] Add "api-endpoint" to component_types
- [ ] Create ApiEndpointNode component
- [ ] Create EndpointConfigPanel
- [ ] Add to node registry
- [ ] Update workflow compiler (if needed)

### Phase 4: Endpoint Registration

- [ ] Create endpoint registration service
- [ ] Integrate with deploy flow
- [ ] Store Kong route IDs in database
- [ ] Handle endpoint updates on re-deploy
- [ ] Clean up endpoints on workflow deletion

### Phase 5: API Route Handler

- [ ] Create Next.js API route handler
- [ ] Map HTTP methods to workflow operations
- [ ] Handle signal sending
- [ ] Handle query execution
- [ ] Handle workflow start
- [ ] Add request validation
- [ ] Add response formatting

### Phase 6: UI Integration

- [ ] Add endpoint component to palette
- [ ] Show endpoint URLs after publish
- [ ] Add endpoint management page
- [ ] Show endpoint status (active/inactive)
- [ ] Allow endpoint deletion

### Phase 7: Testing

- [ ] Unit tests for Kong client
- [ ] Integration tests for endpoint registration
- [ ] E2E tests for endpoint creation flow
- [ ] Test rate limiting
- [ ] Test authentication

## Database Migration

```sql
-- Migration: Create workflow_endpoints table
CREATE TABLE workflow_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  path VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  description TEXT,
  target_type VARCHAR(50) NOT NULL,
  target_name VARCHAR(255) NOT NULL,
  kong_route_id VARCHAR(255),
  kong_service_id VARCHAR(255),
  kong_route_name VARCHAR(255),
  auth_type VARCHAR(50) DEFAULT 'api-key',
  auth_config JSONB DEFAULT '{}',
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_hour INTEGER DEFAULT 1000,
  request_schema JSONB,
  response_schema JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workflow_id, path, method)
);

CREATE INDEX idx_workflow_endpoints_workflow ON workflow_endpoints(workflow_id);
CREATE INDEX idx_workflow_endpoints_kong ON workflow_endpoints(kong_route_id);
```

## Environment Variables

```env
KONG_ADMIN_URL=http://kong:8001
KONG_ADMIN_API_KEY=your-admin-key
KONG_GATEWAY_URL=https://api.yourdomain.com
```

## File Structure

```
src/
├── lib/
│   └── kong/
│       ├── client.ts              # Kong Admin API client
│       ├── endpoint-registry.ts   # Endpoint registration service
│       └── types.ts               # Type definitions
├── components/
│   └── workflow/
│       └── nodes/
│           └── ApiEndpointNode.tsx
├── server/
│   └── api/
│       └── routes/
│           └── workflows/
│               └── [id]/
│                   └── endpoints/
│                       └── [...path]/
│                           └── route.ts
└── app/
    └── api/
        └── workflows/
            └── [id]/
                └── endpoints/
                    └── [...path]/
                        └── route.ts
```

## API Endpoint Component Configuration

```typescript
interface ApiEndpointConfig {
  path: string;              // "/api/v1/orders"
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  targetType: 'start' | 'signal' | 'query';
  targetName: string;        // Signal/query name or 'start'
  description?: string;
  authType: 'none' | 'api-key' | 'jwt';
  rateLimitPerMinute?: number;
  requestSchema?: JSONSchema;
  responseSchema?: JSONSchema;
}
```

## Example Usage

1. User adds "API Endpoint" component to workflow
2. Configures:
   - Path: `/api/v1/process-order`
   - Method: `POST`
   - Target: Signal `orderApproved`
3. Publishes workflow
4. System:
   - Creates Kong service for workflow
   - Creates Kong route for endpoint
   - Enables rate limiting plugin
   - Enables API key auth plugin
   - Stores endpoint in database
5. User receives:
   ```
   ✅ Workflow published!
   
   API Endpoints:
   POST https://api.yourdomain.com/api/v1/process-order
   ```

## Benefits

- **No Code Required**: Users configure endpoints visually
- **Automatic Scaling**: Kong handles routing and load balancing
- **Built-in Security**: API key auth, rate limiting out of the box
- **Easy Updates**: Re-deploy updates endpoints automatically
- **Monitoring**: Kong provides metrics and logging

## Future Enhancements

- Webhook endpoints (receive webhooks, trigger workflows)
- GraphQL endpoint generation
- OpenAPI/Swagger spec generation
- Endpoint versioning
- A/B testing endpoints
- Custom plugins (request transformation, etc.)

