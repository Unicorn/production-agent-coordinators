# Workflow Builder Worker Service

Standalone Temporal worker service that executes workflows compiled from the Workflow Builder UI. This service manages Temporal workers on a per-project basis, dynamically loading workflow code from the database.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Workflow Builder UI                        │
│  (Compiles workflows to TypeScript & stores in database)    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ REST API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Workflow Worker Service                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │           ProjectWorkerManager                     │    │
│  │  - Manages workers per project                     │    │
│  │  - Loads compiled code from database               │    │
│  │  - Dynamic activity loading                        │    │
│  │  - Health monitoring & heartbeats                  │    │
│  └────────────────────────────────────────────────────┘    │
│                     │                                        │
│         ┌───────────┼───────────┐                           │
│         ▼           ▼           ▼                           │
│    [Worker-1]  [Worker-2]  [Worker-N]                       │
│    Project A   Project B   Project N                        │
└─────────┬───────────┬───────────┬──────────────────────────┘
          │           │           │
          └───────────┴───────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │   Temporal Server     │
          │   (Workflow Engine)   │
          └───────────────────────┘
```

## Features

- **Per-Project Workers**: Each project gets its own dedicated Temporal worker
- **Dynamic Code Loading**: Workflows and activities loaded from database at runtime
- **Custom Activities**: Support for project-specific custom activities
- **Hot Reloading**: Workers can be restarted to load updated workflow code
- **Health Monitoring**: Built-in health checks and heartbeat tracking
- **Graceful Shutdown**: Proper cleanup of workers on service shutdown
- **Sample Activities**: Pre-built activities for common workflow tasks

## Quick Start

### Prerequisites

- Node.js 20+
- Temporal Server running (see Docker Compose)
- Supabase instance with workflow tables

### Environment Variables

Create a `.env` file:

```bash
# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# Worker Service Configuration
WORKER_SERVICE_PORT=3011
NODE_ENV=development

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Development Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build the Service**
   ```bash
   npm run build
   ```

3. **Start Temporal Server** (from project root)
   ```bash
   cd ../.. && docker-compose -f docker/docker-compose.yml up temporal
   ```

4. **Start Worker Service**
   ```bash
   npm run dev    # Development with hot reload
   npm start      # Production mode
   ```

### Using Start Scripts

```bash
# Development mode with auto-restart
./scripts/start-worker.sh dev

# Production mode
./scripts/start-worker.sh

# With custom environment
TEMPORAL_ADDRESS=temporal:7233 ./scripts/start-worker.sh
```

## API Endpoints

### Health Check
```bash
GET /health
```
Returns service health status.

**Response:**
```json
{
  "status": "ok",
  "service": "temporal-worker-service"
}
```

### Start Worker for Project
```bash
POST /workers/start
Content-Type: application/json

{
  "projectId": "uuid-of-project"
}
```

Starts a Temporal worker for the specified project. The worker will:
1. Load all active workflows for the project from database
2. Load custom activities for the project
3. Create Temporal worker with loaded code
4. Register in database with health monitoring

**Response:**
```json
{
  "success": true,
  "message": "Worker started for project {projectId}"
}
```

### Stop Worker for Project
```bash
POST /workers/stop
Content-Type: application/json

{
  "projectId": "uuid-of-project"
}
```

Gracefully stops the worker for a project.

### Restart Worker for Project
```bash
POST /workers/restart
Content-Type: application/json

{
  "projectId": "uuid-of-project"
}
```

Stops and restarts the worker to reload updated workflow code.

### Get Worker Status
```bash
GET /workers/status/:projectId
```

Returns the current status of a project's worker.

**Response:**
```json
{
  "projectId": "uuid-of-project",
  "status": "running",
  "isRunning": true
}
```

### List All Workers
```bash
GET /workers
```

Returns all currently running workers.

**Response:**
```json
{
  "workers": ["project-id-1", "project-id-2"],
  "count": 2
}
```

## Sample Activities

The service includes pre-built activities for common workflow tasks:

### sampleActivity
Basic activity demonstrating input/output patterns.

```typescript
await proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
}).sampleActivity({ message: 'Hello World' });
```

### buildPackage
Placeholder for package building workflows.

```typescript
const result = await buildPackage({
  packageName: 'my-package',
  version: '1.0.0',
});
// Returns: { success, packageName, buildTime, artifacts }
```

### httpRequest
Make HTTP requests from workflows.

```typescript
const response = await httpRequest({
  url: 'https://api.example.com/data',
  method: 'POST',
  headers: { 'Authorization': 'Bearer token' },
  body: { key: 'value' },
});
// Returns: { status, statusText, data, headers }
```

### transformData
Transform data with common operations.

```typescript
const result = await transformData({
  data: 'hello world',
  transformation: 'uppercase',
});
// Returns: 'HELLO WORLD'
```

### waitFor
Introduce delays in workflow execution.

```typescript
await waitFor({
  milliseconds: 5000,
  reason: 'Waiting for external system',
});
```

### logMessage
Log messages at different levels.

```typescript
await logMessage({
  level: 'info',
  message: 'Processing started',
  data: { userId: '123' },
});
```

### validateData
Validate data against rules.

```typescript
const result = await validateData({
  data: 'user@example.com',
  rules: {
    required: true,
    type: 'string',
    pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$',
  },
});
// Returns: { valid: true, errors: [] }
```

## Custom Activities

Projects can define custom activities in the Workflow Builder UI. These are stored in the `components` table and loaded automatically when a worker starts.

**Custom Activity Requirements:**
- Must be valid TypeScript/JavaScript
- Must export named functions
- Must handle async operations properly
- Must include proper error handling

**Example Custom Activity:**
```typescript
export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
}) {
  // Your email sending logic
  console.log(`Sending email to ${input.to}`);
  // ... implementation ...
  return { success: true, messageId: 'abc123' };
}
```

## Worker Lifecycle

### Worker Startup
1. Worker receives start request via API
2. Loads project details from database
3. Loads all active workflows for the project
4. Loads custom activities from components
5. Creates temporary directory for bundled code
6. Writes workflow and activity code to files
7. Creates Temporal connection
8. Creates worker with bundled code
9. Registers worker in database
10. Starts heartbeat monitoring
11. Worker begins polling for tasks

### Worker Execution
1. Temporal schedules workflow on project's task queue
2. Worker picks up workflow task
3. Executes workflow code with activities
4. Updates workflow state in Temporal
5. Continues until workflow completes or fails

### Worker Shutdown
1. Receives shutdown signal (API call or process signal)
2. Stops accepting new workflow tasks
3. Completes in-flight workflow tasks
4. Stops heartbeat
5. Updates status in database
6. Cleans up temporary files
7. Closes Temporal connection

## Docker Deployment

### Using Docker Compose

The worker service is included in the main docker-compose.yml:

```bash
# Start all services including worker
docker-compose -f docker/docker-compose.yml up -d

# Start only worker service
docker-compose -f docker/docker-compose.yml up -d workflow-worker-service

# View worker logs
docker-compose -f docker/docker-compose.yml logs -f workflow-worker-service

# Restart worker service
docker-compose -f docker/docker-compose.yml restart workflow-worker-service
```

### Building Docker Image

```bash
# Build image
docker build -t workflow-worker-service .

# Run container
docker run -d \
  --name workflow-worker \
  -p 3011:3011 \
  -e TEMPORAL_ADDRESS=temporal:7233 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key \
  workflow-worker-service
```

## Monitoring

### Health Checks

The service provides a health endpoint for monitoring:

```bash
curl http://localhost:3011/health
```

### Worker Status

Check worker status in database:

```sql
SELECT
  worker_id,
  project_id,
  status,
  started_at,
  last_heartbeat,
  EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) as seconds_since_heartbeat
FROM workflow_workers
WHERE status = 'running';
```

### Temporal UI

Monitor workflow executions in Temporal UI:
```
http://localhost:8080
```

## Troubleshooting

### Worker Not Starting

**Problem:** Worker fails to start for a project

**Solutions:**
1. Check Temporal connection:
   ```bash
   curl http://localhost:7233
   ```

2. Verify project has compiled workflows:
   ```sql
   SELECT id, kebab_name FROM workflows
   WHERE project_id = 'your-project-id' AND is_active = true;
   ```

3. Check worker service logs:
   ```bash
   docker-compose -f docker/docker-compose.yml logs workflow-worker-service
   ```

### Workflows Not Executing

**Problem:** Workflows appear stuck or not executing

**Solutions:**
1. Verify worker is running:
   ```bash
   curl http://localhost:3011/workers/status/your-project-id
   ```

2. Check Temporal UI for task queue workers
3. Verify task queue name matches between workflow definition and project
4. Check for activity failures in Temporal UI

### Activity Failures

**Problem:** Activities are failing during execution

**Solutions:**
1. Check activity code for errors
2. Verify activity timeout settings
3. Check activity retry policies
4. Review activity logs in worker service

### Code Not Updating

**Problem:** Changes to workflow code not reflected in execution

**Solutions:**
1. Restart the worker to reload code:
   ```bash
   curl -X POST http://localhost:3011/workers/restart \
     -H "Content-Type: application/json" \
     -d '{"projectId": "your-project-id"}'
   ```

2. Verify workflow was recompiled in UI
3. Check that `is_active` flag is set on latest compiled code

## Development

### Project Structure

```
workflow-worker-service/
├── src/
│   ├── activities/           # Sample activities
│   │   ├── index.ts         # Activity registry
│   │   └── sample.activities.ts
│   ├── connection.ts         # Temporal connection
│   ├── server.ts            # Express server
│   ├── storage.ts           # Database operations
│   ├── worker-manager.ts    # Worker lifecycle management
│   ├── statistics.ts        # Worker statistics
│   └── types.ts             # TypeScript types
├── scripts/
│   └── start-worker.sh      # Start script
├── Dockerfile               # Container definition
├── .dockerignore           # Docker ignore patterns
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
└── README.md              # This file
```

### Adding New Sample Activities

1. Add function to `src/activities/sample.activities.ts`
2. Export from `src/activities/index.ts`
3. Rebuild and restart service
4. Activity is now available to all workflows

### Testing

```bash
# Run tests
npm test

# Test worker connection manually
npm run dev

# In another terminal, start a worker
curl -X POST http://localhost:3011/workers/start \
  -H "Content-Type: application/json" \
  -d '{"projectId": "test-project-id"}'
```

## Performance Tuning

### Worker Concurrency

Set via environment variables:

```bash
MAX_CONCURRENT_ACTIVITY_EXECUTIONS=10
MAX_CONCURRENT_WORKFLOW_EXECUTIONS=10
```

### Heartbeat Interval

Heartbeat interval is set to 30 seconds by default. Adjust in `worker-manager.ts`:

```typescript
const interval = setInterval(async () => {
  // ... heartbeat logic
}, 30000); // 30 seconds
```

### Worker Shutdown Timeout

Temporal workers shutdown gracefully by default, waiting for in-flight tasks to complete.

## Security Considerations

- Service role key for Supabase should be kept secure
- Workers run in isolated Docker containers
- Temporary workflow code is stored in isolated directories
- Each project's code is isolated from other projects
- Non-root user in Docker containers

## License

See project root LICENSE file.

## Support

For issues and questions, please create an issue in the project repository.
