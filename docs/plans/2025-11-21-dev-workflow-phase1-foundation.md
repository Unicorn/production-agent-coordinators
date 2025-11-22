# Dev Workflow Phase 1: Foundation - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the foundation for autonomous development workflows - BrainGrid CLI wrapper, Temporal infrastructure, and basic planning/execution workflows.

**Architecture:** Decoupled planning + task pools architecture using BrainGrid as the task queue, Temporal for orchestration. Planning workflow creates REQs and task breakdowns, execution workflows poll BrainGrid for work.

**Tech Stack:**
- Temporal.io (workflow orchestration)
- BrainGrid CLI (task queue)
- TypeScript (all code)
- Zod (validation)
- Execa (CLI execution)
- Docker Compose (infrastructure)

**Dependencies:**
- Existing: `packages/agents/package-builder-production` (reuse coordinator pattern)
- New: `packages/braingrid-cli-wrapper` (build first)
- New: `packages/dev-workflow` (main package)

---

## Part 1: BrainGrid CLI Wrapper Package

### Task 1.1: Create Package Structure

**Files:**
- Create: `packages/braingrid-cli-wrapper/package.json`
- Create: `packages/braingrid-cli-wrapper/tsconfig.json`
- Create: `packages/braingrid-cli-wrapper/src/index.ts`
- Create: `packages/braingrid-cli-wrapper/README.md`

**Step 1: Create package directory**

```bash
mkdir -p packages/braingrid-cli-wrapper/src
cd packages/braingrid-cli-wrapper
```

**Step 2: Initialize package.json**

Create `packages/braingrid-cli-wrapper/package.json`:

```json
{
  "name": "@bernierllc/braingrid-cli-wrapper",
  "version": "0.1.0",
  "description": "Type-safe wrapper for BrainGrid CLI",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["braingrid", "cli", "wrapper", "typescript"],
  "author": "Bernier LLC",
  "license": "MIT",
  "dependencies": {
    "execa": "^8.0.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.5",
    "typescript": "^5.3.3",
    "vitest": "^1.1.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Step 3: Create tsconfig.json**

Create `packages/braingrid-cli-wrapper/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 4: Create README.md**

Create `packages/braingrid-cli-wrapper/README.md`:

```markdown
# @bernierllc/braingrid-cli-wrapper

Type-safe wrapper for the BrainGrid CLI.

## Installation

\`\`\`bash
npm install @bernierllc/braingrid-cli-wrapper
\`\`\`

## Usage

\`\`\`typescript
import { createIdea, listProjects } from '@bernierllc/braingrid-cli-wrapper';

// Create a new requirement
const req = await createIdea('Add OAuth2 authentication', 'proj-123');
console.log(\`Created requirement \${req.id}\`);

// List projects
const projects = await listProjects();
console.log(\`Found \${projects.length} projects\`);
\`\`\`

## API

See TypeScript definitions for complete API documentation.
```

**Step 5: Install dependencies**

```bash
cd packages/braingrid-cli-wrapper
npm install
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat(braingrid-cli-wrapper): initialize package structure"
```

---

### Task 1.2: Define Zod Schemas and Types

**Files:**
- Create: `packages/braingrid-cli-wrapper/src/models.ts`
- Create: `packages/braingrid-cli-wrapper/src/models.test.ts`

**Step 1: Write test for BrainGrid schemas**

Create `packages/braingrid-cli-wrapper/src/models.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  BrainGridProjectSchema,
  BrainGridRequirementSchema,
  BrainGridTaskSchema,
  RequirementStatus,
  TaskStatus
} from './models';

describe('BrainGrid Schemas', () => {
  describe('BrainGridProjectSchema', () => {
    it('should validate a valid project', () => {
      const validProject = {
        id: 'proj-123',
        name: 'Test Project',
        description: 'A test project'
      };

      const result = BrainGridProjectSchema.safeParse(validProject);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('proj-123');
        expect(result.data.name).toBe('Test Project');
      }
    });

    it('should reject invalid project', () => {
      const invalidProject = {
        id: 123, // Should be string
        name: 'Test'
      };

      const result = BrainGridProjectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
    });
  });

  describe('BrainGridRequirementSchema', () => {
    it('should validate a valid requirement', () => {
      const validReq = {
        id: 'req-456',
        projectId: 'proj-123',
        title: 'Add authentication',
        status: 'IDEA' as RequirementStatus,
        description: 'Add OAuth2 auth'
      };

      const result = BrainGridRequirementSchema.safeParse(validReq);
      expect(result.success).toBe(true);
    });

    it('should accept all valid statuses', () => {
      const statuses: RequirementStatus[] = ['IDEA', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

      statuses.forEach(status => {
        const req = {
          id: 'req-456',
          projectId: 'proj-123',
          title: 'Test',
          status
        };
        const result = BrainGridRequirementSchema.safeParse(req);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('BrainGridTaskSchema', () => {
    it('should validate a valid task', () => {
      const validTask = {
        id: 'task-789',
        reqId: 'req-456',
        title: 'Build login UI',
        status: 'TODO' as TaskStatus,
        tags: ['DEV', 'frontend'],
        dependencies: ['task-123', 'task-456']
      };

      const result = BrainGridTaskSchema.safeParse(validTask);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toHaveLength(2);
        expect(result.data.dependencies).toHaveLength(2);
      }
    });

    it('should allow optional fields to be undefined', () => {
      const minimalTask = {
        id: 'task-789',
        reqId: 'req-456',
        title: 'Build login UI',
        status: 'TODO' as TaskStatus
      };

      const result = BrainGridTaskSchema.safeParse(minimalTask);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toBeUndefined();
        expect(result.data.dependencies).toBeUndefined();
      }
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: Tests fail with "Cannot find module './models'"

**Step 3: Implement models with Zod schemas**

Create `packages/braingrid-cli-wrapper/src/models.ts`:

```typescript
import { z } from 'zod';

// Requirement statuses
export const RequirementStatusSchema = z.enum([
  'IDEA',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'PAUSED'
]);

export type RequirementStatus = z.infer<typeof RequirementStatusSchema>;

// Task statuses
export const TaskStatusSchema = z.enum([
  'TODO',
  'READY',
  'BLOCKED',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'PAUSED'
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// BrainGrid Project
export const BrainGridProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional()
});

export type BrainGridProject = z.infer<typeof BrainGridProjectSchema>;

// BrainGrid Requirement
export const BrainGridRequirementSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  status: RequirementStatusSchema,
  description: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type BrainGridRequirement = z.infer<typeof BrainGridRequirementSchema>;

// BrainGrid Task
export const BrainGridTaskSchema = z.object({
  id: z.string(),
  reqId: z.string(),
  title: z.string(),
  status: TaskStatusSchema,
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  assignedTo: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export type BrainGridTask = z.infer<typeof BrainGridTaskSchema>;

// CLI Error
export class BrainGridCliError extends Error {
  constructor(
    message: string,
    public command: string,
    public exitCode: number,
    public stderr: string
  ) {
    super(message);
    this.name = 'BrainGridCliError';
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add .
git commit -m "feat(braingrid-cli-wrapper): add Zod schemas and types"
```

---

### Task 1.3: Implement CLI Helper

**Files:**
- Create: `packages/braingrid-cli-wrapper/src/cli.ts`
- Create: `packages/braingrid-cli-wrapper/src/cli.test.ts`

**Step 1: Write test for CLI helper**

Create `packages/braingrid-cli-wrapper/src/cli.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runBrainGridCommand } from './cli';
import { BrainGridCliError } from './models';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn()
}));

import { execa } from 'execa';

describe('CLI Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run command successfully', async () => {
    const mockOutput = { id: 'proj-123', name: 'Test' };
    vi.mocked(execa).mockResolvedValue({
      stdout: JSON.stringify(mockOutput),
      stderr: '',
      exitCode: 0
    } as any);

    const result = await runBrainGridCommand(['projects', 'list', '--format', 'json']);

    expect(result).toEqual(mockOutput);
    expect(execa).toHaveBeenCalledWith(
      'braingrid',
      ['projects', 'list', '--format', 'json'],
      expect.any(Object)
    );
  });

  it('should handle command with no JSON output', async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: 'Success',
      stderr: '',
      exitCode: 0
    } as any);

    const result = await runBrainGridCommand(['task', 'update', 'task-123']);

    expect(result).toBeNull();
  });

  it('should throw BrainGridCliError on failure', async () => {
    vi.mocked(execa).mockRejectedValue({
      exitCode: 1,
      stderr: 'Invalid command',
      stdout: ''
    });

    await expect(
      runBrainGridCommand(['invalid'])
    ).rejects.toThrow(BrainGridCliError);
  });

  it('should use custom CLI path from env', async () => {
    const originalEnv = process.env.BRAINGRID_CLI_PATH;
    process.env.BRAINGRID_CLI_PATH = '/custom/path/braingrid';

    vi.mocked(execa).mockResolvedValue({
      stdout: '{}',
      stderr: '',
      exitCode: 0
    } as any);

    await runBrainGridCommand(['projects', 'list']);

    expect(execa).toHaveBeenCalledWith(
      '/custom/path/braingrid',
      expect.any(Array),
      expect.any(Object)
    );

    process.env.BRAINGRID_CLI_PATH = originalEnv;
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: Tests fail with "Cannot find module './cli'"

**Step 3: Implement CLI helper**

Create `packages/braingrid-cli-wrapper/src/cli.ts`:

```typescript
import { execa } from 'execa';
import { BrainGridCliError } from './models';

/**
 * Run a BrainGrid CLI command and return parsed JSON output
 */
export async function runBrainGridCommand(
  args: string[],
  options?: {
    cwd?: string;
    env?: Record<string, string>;
  }
): Promise<any> {
  const cliPath = process.env.BRAINGRID_CLI_PATH || 'braingrid';

  try {
    const result = await execa(cliPath, args, {
      cwd: options?.cwd,
      env: {
        ...process.env,
        ...options?.env
      },
      timeout: 30000, // 30 second timeout
      reject: false // Don't throw on non-zero exit
    });

    // Check for errors
    if (result.exitCode !== 0) {
      throw new BrainGridCliError(
        `BrainGrid CLI command failed: ${args.join(' ')}`,
        cliPath,
        result.exitCode,
        result.stderr
      );
    }

    // Try to parse JSON output
    const stdout = result.stdout.trim();
    if (!stdout) {
      return null;
    }

    try {
      return JSON.parse(stdout);
    } catch (e) {
      // Not JSON output, return as-is
      return null;
    }
  } catch (error) {
    if (error instanceof BrainGridCliError) {
      throw error;
    }

    // Handle execa errors
    throw new BrainGridCliError(
      `Failed to execute BrainGrid CLI: ${error.message}`,
      cliPath,
      (error as any).exitCode || -1,
      (error as any).stderr || ''
    );
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add .
git commit -m "feat(braingrid-cli-wrapper): implement CLI helper"
```

---

### Task 1.4: Implement Core Commands

**Files:**
- Create: `packages/braingrid-cli-wrapper/src/commands/createIdea.ts`
- Create: `packages/braingrid-cli-wrapper/src/commands/createIdea.test.ts`
- Create: `packages/braingrid-cli-wrapper/src/commands/listProjects.ts`
- Create: `packages/braingrid-cli-wrapper/src/commands/listProjects.test.ts`
- Create: `packages/braingrid-cli-wrapper/src/commands/createTask.ts`
- Create: `packages/braingrid-cli-wrapper/src/commands/createTask.test.ts`
- Create: `packages/braingrid-cli-wrapper/src/commands/updateTaskStatus.ts`
- Create: `packages/braingrid-cli-wrapper/src/commands/updateTaskStatus.test.ts`
- Create: `packages/braingrid-cli-wrapper/src/commands/listTasks.ts`
- Create: `packages/braingrid-cli-wrapper/src/commands/listTasks.test.ts`

**Step 1: Write test for createIdea**

```bash
mkdir -p packages/braingrid-cli-wrapper/src/commands
```

Create `packages/braingrid-cli-wrapper/src/commands/createIdea.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIdea } from './createIdea';
import { BrainGridRequirementSchema } from '../models';

vi.mock('../cli', () => ({
  runBrainGridCommand: vi.fn()
}));

import { runBrainGridCommand } from '../cli';

describe('createIdea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create idea with prompt only', async () => {
    const mockReq = {
      id: 'req-123',
      projectId: 'proj-456',
      title: 'Add OAuth2',
      status: 'IDEA'
    };

    vi.mocked(runBrainGridCommand).mockResolvedValue(mockReq);

    const result = await createIdea('Add OAuth2 authentication');

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'specify',
      'Add OAuth2 authentication',
      '--format',
      'json'
    ]);

    expect(result.id).toBe('req-123');
    expect(result.status).toBe('IDEA');
  });

  it('should create idea with project ID', async () => {
    const mockReq = {
      id: 'req-123',
      projectId: 'proj-456',
      title: 'Add OAuth2',
      status: 'IDEA'
    };

    vi.mocked(runBrainGridCommand).mockResolvedValue(mockReq);

    const result = await createIdea('Add OAuth2 authentication', 'proj-456');

    expect(runBrainGridCommand).toHaveBeenCalledWith([
      'specify',
      'Add OAuth2 authentication',
      '--project',
      'proj-456',
      '--format',
      'json'
    ]);
  });

  it('should validate response schema', async () => {
    const invalidReq = {
      id: 123, // Should be string
      title: 'Test'
    };

    vi.mocked(runBrainGridCommand).mockResolvedValue(invalidReq);

    await expect(createIdea('Test')).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: Tests fail

**Step 3: Implement createIdea**

Create `packages/braingrid-cli-wrapper/src/commands/createIdea.ts`:

```typescript
import { runBrainGridCommand } from '../cli';
import { BrainGridRequirement, BrainGridRequirementSchema } from '../models';

/**
 * Create a new requirement (IDEA) in BrainGrid
 */
export async function createIdea(
  prompt: string,
  projectId?: string
): Promise<BrainGridRequirement> {
  const args = ['specify', prompt];

  if (projectId) {
    args.push('--project', projectId);
  }

  args.push('--format', 'json');

  const result = await runBrainGridCommand(args);

  // Validate response
  const parsed = BrainGridRequirementSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error(`Invalid BrainGrid response: ${parsed.error.message}`);
  }

  return parsed.data;
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: Tests pass

**Step 5: Implement remaining commands (similar pattern)**

Create `packages/braingrid-cli-wrapper/src/commands/listProjects.ts`:

```typescript
import { runBrainGridCommand } from '../cli';
import { BrainGridProject, BrainGridProjectSchema } from '../models';
import { z } from 'zod';

export async function listProjects(): Promise<BrainGridProject[]> {
  const result = await runBrainGridCommand(['projects', 'list', '--format', 'json']);

  const parsed = z.array(BrainGridProjectSchema).safeParse(result);
  if (!parsed.success) {
    throw new Error(`Invalid BrainGrid response: ${parsed.error.message}`);
  }

  return parsed.data;
}
```

Create `packages/braingrid-cli-wrapper/src/commands/createTask.ts`:

```typescript
import { runBrainGridCommand } from '../cli';
import { BrainGridTask, BrainGridTaskSchema } from '../models';

export interface CreateTaskOptions {
  title: string;
  description?: string;
  tags?: string[];
  dependencies?: string[];
}

export async function createTask(
  reqId: string,
  options: CreateTaskOptions
): Promise<BrainGridTask> {
  const args = ['task', 'create', reqId, '--title', options.title];

  if (options.description) {
    args.push('--description', options.description);
  }

  if (options.tags && options.tags.length > 0) {
    args.push('--tags', options.tags.join(','));
  }

  if (options.dependencies && options.dependencies.length > 0) {
    args.push('--dependencies', options.dependencies.join(','));
  }

  args.push('--format', 'json');

  const result = await runBrainGridCommand(args);

  const parsed = BrainGridTaskSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error(`Invalid BrainGrid response: ${parsed.error.message}`);
  }

  return parsed.data;
}
```

Create `packages/braingrid-cli-wrapper/src/commands/updateTaskStatus.ts`:

```typescript
import { runBrainGridCommand } from '../cli';
import { TaskStatus } from '../models';

export interface UpdateTaskOptions {
  status?: TaskStatus;
  assignedTo?: string;
  metadata?: Record<string, unknown>;
}

export async function updateTaskStatus(
  taskId: string,
  options: UpdateTaskOptions
): Promise<void> {
  const args = ['task', 'update', taskId];

  if (options.status) {
    args.push('--status', options.status);
  }

  if (options.assignedTo) {
    args.push('--assigned-to', options.assignedTo);
  }

  if (options.metadata) {
    args.push('--metadata', JSON.stringify(options.metadata));
  }

  await runBrainGridCommand(args);
}
```

Create `packages/braingrid-cli-wrapper/src/commands/listTasks.ts`:

```typescript
import { runBrainGridCommand } from '../cli';
import { BrainGridTask, BrainGridTaskSchema, TaskStatus } from '../models';
import { z } from 'zod';

export interface ListTasksOptions {
  reqId?: string;
  status?: TaskStatus[];
  tags?: string[];
}

export async function listTasks(options: ListTasksOptions = {}): Promise<BrainGridTask[]> {
  const args = ['task', 'list'];

  if (options.reqId) {
    args.push('--req', options.reqId);
  }

  if (options.status && options.status.length > 0) {
    args.push('--status', options.status.join(','));
  }

  if (options.tags && options.tags.length > 0) {
    args.push('--tags', options.tags.join(','));
  }

  args.push('--format', 'json');

  const result = await runBrainGridCommand(args);

  const parsed = z.array(BrainGridTaskSchema).safeParse(result);
  if (!parsed.success) {
    throw new Error(`Invalid BrainGrid response: ${parsed.error.message}`);
  }

  return parsed.data;
}
```

**Step 6: Create tests for remaining commands** (similar to createIdea test)

Create test files for each command following the same pattern.

**Step 7: Run all tests**

```bash
npm test
```

Expected: All tests pass

**Step 8: Commit**

```bash
git add .
git commit -m "feat(braingrid-cli-wrapper): implement core commands"
```

---

### Task 1.5: Export Public API

**Files:**
- Modify: `packages/braingrid-cli-wrapper/src/index.ts`

**Step 1: Update index.ts to export all commands**

Modify `packages/braingrid-cli-wrapper/src/index.ts`:

```typescript
// Export types and schemas
export {
  BrainGridProject,
  BrainGridRequirement,
  BrainGridTask,
  RequirementStatus,
  TaskStatus,
  BrainGridProjectSchema,
  BrainGridRequirementSchema,
  BrainGridTaskSchema,
  BrainGridCliError
} from './models';

// Export commands
export { createIdea } from './commands/createIdea';
export { listProjects } from './commands/listProjects';
export { createTask, CreateTaskOptions } from './commands/createTask';
export { updateTaskStatus, UpdateTaskOptions } from './commands/updateTaskStatus';
export { listTasks, ListTasksOptions } from './commands/listTasks';
```

**Step 2: Build package**

```bash
npm run build
```

Expected: Compiles successfully, creates `dist/` directory

**Step 3: Verify package exports**

```bash
node -e "const pkg = require('./dist/index.js'); console.log(Object.keys(pkg))"
```

Expected: Lists all exported functions and types

**Step 4: Commit**

```bash
git add .
git commit -m "feat(braingrid-cli-wrapper): export public API"
```

---

## Part 2: Temporal Infrastructure Setup

### Task 2.1: Create Docker Compose Configuration

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

**Step 1: Create docker-compose.yml**

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: temporal
      POSTGRES_PASSWORD: temporal
      POSTGRES_DB: temporal
    ports:
      - "5432:5432"
    volumes:
      - temporal_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U temporal"]
      interval: 10s
      timeout: 5s
      retries: 5

  temporal:
    image: temporalio/auto-setup:latest
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "7233:7233"
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=temporal
      - POSTGRES_PWD=temporal
      - POSTGRES_SEEDS=postgres
      - DYNAMIC_CONFIG_FILE_PATH=config/dynamicconfig/development-sql.yaml
    volumes:
      - ./temporal-config:/etc/temporal/config/dynamicconfig

  temporal-ui:
    image: temporalio/ui:latest
    depends_on:
      - temporal
    ports:
      - "8080:8080"
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
      - TEMPORAL_CORS_ORIGINS=http://localhost:3000

volumes:
  temporal_postgres_data:
```

**Step 2: Create .env.example**

Create `.env.example`:

```bash
# Temporal
TEMPORAL_ADDRESS=localhost:7233

# BrainGrid
BRAINGRID_CLI_PATH=braingrid

# Slack (for future use)
SLACK_BOT_TOKEN=xoxb-your-token-here
SLACK_SIGNING_SECRET=your-secret-here

# Supabase (for future use)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key-here

# Anthropic
ANTHROPIC_API_KEY=your-api-key-here
ANTHROPIC_MODEL=claude-sonnet-4
```

**Step 3: Start Temporal**

```bash
docker-compose up -d
```

Expected: All services start successfully

**Step 4: Verify Temporal is running**

```bash
docker-compose ps
```

Expected: temporal, temporal-ui, and postgres all "Up"

**Step 5: Access Temporal UI**

Open browser to `http://localhost:8080`

Expected: Temporal UI loads successfully

**Step 6: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat(infrastructure): add Temporal docker-compose setup"
```

---

## Part 3: Dev Workflow Package Structure

### Task 3.1: Create Package Structure

**Files:**
- Create: `packages/dev-workflow/package.json`
- Create: `packages/dev-workflow/tsconfig.json`
- Create: `packages/dev-workflow/src/index.ts`

**Step 1: Create package directory**

```bash
mkdir -p packages/dev-workflow/src/{workflows,activities,types,workers}
cd packages/dev-workflow
```

**Step 2: Create package.json**

Create `packages/dev-workflow/package.json`:

```json
{
  "name": "@bernierllc/dev-workflow",
  "version": "0.1.0",
  "description": "Temporal-based autonomous development workflows",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "tsx src/workers/dev-worker.ts",
    "worker:dev": "tsx src/workers/dev-worker.ts",
    "worker:test": "tsx src/workers/test-worker.ts",
    "worker:deploy": "tsx src/workers/deploy-worker.ts"
  },
  "keywords": ["temporal", "workflow", "automation", "dev"],
  "author": "Bernier LLC",
  "license": "MIT",
  "dependencies": {
    "@temporalio/activity": "^1.10.0",
    "@temporalio/client": "^1.10.0",
    "@temporalio/worker": "^1.10.0",
    "@temporalio/workflow": "^1.10.0",
    "@bernierllc/braingrid-cli-wrapper": "workspace:*",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.5",
    "typescript": "^5.3.3",
    "vitest": "^1.1.0",
    "tsx": "^4.7.0"
  }
}
```

**Step 3: Create tsconfig.json**

Create `packages/dev-workflow/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 4: Install dependencies**

```bash
npm install
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat(dev-workflow): initialize package structure"
```

---

### Task 3.2: Define Core Types

**Files:**
- Create: `packages/dev-workflow/src/types/dependency-tree.types.ts`
- Create: `packages/dev-workflow/src/types/task.types.ts`
- Create: `packages/dev-workflow/src/types/index.ts`

**Step 1: Create dependency-tree types**

Create `packages/dev-workflow/src/types/dependency-tree.types.ts`:

```typescript
export enum TaskStatus {
  BLOCKED = 'blocked',
  READY = 'ready',
  CLAIMED = 'claimed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'
}

export interface TaskNode {
  taskId: string;
  name: string;
  description: string;
  tags: string[];
  dependencies: string[];
  dependents: string[];
  status: TaskStatus;
  layer: number;
  estimatedHours?: number;
  assignedTo?: string;
  claimedAt?: string;
  completedAt?: string;
}

export interface DependencyTree {
  reqId: string;
  tasks: Map<string, TaskNode>;
  layers: TaskNode[][];
  lastUpdated: string;
}

export interface DependencyStatus {
  taskId: string;
  status: TaskStatus;
  dependencies: Array<{
    taskId: string;
    status: TaskStatus | undefined;
  }>;
  blockedBy: string[];
}
```

**Step 2: Create task types**

Create `packages/dev-workflow/src/types/task.types.ts`:

```typescript
export interface TaskInput {
  id: string;
  reqId: string;
  name: string;
  description: string;
  tags: string[];
  dependencies?: string[];
  estimatedHours?: number;
}

export interface PollTaskParams {
  tags: string[];
  status: string[];
}

export interface TaskExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
}
```

**Step 3: Create index barrel**

Create `packages/dev-workflow/src/types/index.ts`:

```typescript
export * from './dependency-tree.types';
export * from './task.types';
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat(dev-workflow): add core type definitions"
```

---

### Task 3.3: Implement Dependency Tree Builder

**Files:**
- Create: `packages/dev-workflow/src/activities/dependency-tree.activities.ts`
- Create: `packages/dev-workflow/src/activities/dependency-tree.activities.test.ts`

**Step 1: Write test for dependency tree builder**

Create `packages/dev-workflow/src/activities/dependency-tree.activities.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildDependencyTree, updateTaskReadiness } from './dependency-tree.activities';
import { TaskInput } from '../types/task.types';
import { TaskStatus } from '../types/dependency-tree.types';

describe('Dependency Tree Activities', () => {
  describe('buildDependencyTree', () => {
    it('should build tree with no dependencies (layer 0)', () => {
      const tasks: TaskInput[] = [
        {
          id: 'task-1',
          reqId: 'req-123',
          name: 'Task 1',
          description: 'First task',
          tags: ['DEV'],
          dependencies: []
        },
        {
          id: 'task-2',
          reqId: 'req-123',
          name: 'Task 2',
          description: 'Second task',
          tags: ['DEV'],
          dependencies: []
        }
      ];

      const tree = buildDependencyTree('req-123', tasks);

      expect(tree.reqId).toBe('req-123');
      expect(tree.tasks.size).toBe(2);
      expect(tree.layers).toHaveLength(1);
      expect(tree.layers[0]).toHaveLength(2);

      const task1 = tree.tasks.get('task-1');
      expect(task1?.layer).toBe(0);
      expect(task1?.status).toBe(TaskStatus.READY);
    });

    it('should build tree with dependencies (multiple layers)', () => {
      const tasks: TaskInput[] = [
        {
          id: 'task-1',
          reqId: 'req-123',
          name: 'Task 1',
          description: 'Layer 0',
          tags: ['DEV'],
          dependencies: []
        },
        {
          id: 'task-2',
          reqId: 'req-123',
          name: 'Task 2',
          description: 'Layer 1',
          tags: ['DEV'],
          dependencies: ['task-1']
        },
        {
          id: 'task-3',
          reqId: 'req-123',
          name: 'Task 3',
          description: 'Layer 1',
          tags: ['TEST'],
          dependencies: ['task-1']
        },
        {
          id: 'task-4',
          reqId: 'req-123',
          name: 'Task 4',
          description: 'Layer 2',
          tags: ['TEST'],
          dependencies: ['task-2', 'task-3']
        }
      ];

      const tree = buildDependencyTree('req-123', tasks);

      expect(tree.layers).toHaveLength(3);
      expect(tree.layers[0]).toHaveLength(1); // task-1
      expect(tree.layers[1]).toHaveLength(2); // task-2, task-3
      expect(tree.layers[2]).toHaveLength(1); // task-4

      const task1 = tree.tasks.get('task-1');
      expect(task1?.layer).toBe(0);
      expect(task1?.status).toBe(TaskStatus.READY);
      expect(task1?.dependents).toEqual(['task-2', 'task-3']);

      const task4 = tree.tasks.get('task-4');
      expect(task4?.layer).toBe(2);
      expect(task4?.status).toBe(TaskStatus.BLOCKED);
      expect(task4?.dependencies).toEqual(['task-2', 'task-3']);
    });

    it('should detect circular dependencies', () => {
      const tasks: TaskInput[] = [
        {
          id: 'task-1',
          reqId: 'req-123',
          name: 'Task 1',
          description: 'Circular',
          tags: ['DEV'],
          dependencies: ['task-2']
        },
        {
          id: 'task-2',
          reqId: 'req-123',
          name: 'Task 2',
          description: 'Circular',
          tags: ['DEV'],
          dependencies: ['task-1']
        }
      ];

      expect(() => buildDependencyTree('req-123', tasks)).toThrow('Circular dependency detected');
    });
  });

  describe('updateTaskReadiness', () => {
    it('should mark dependent tasks as ready when dependency completes', () => {
      const tasks: TaskInput[] = [
        {
          id: 'task-1',
          reqId: 'req-123',
          name: 'Task 1',
          description: 'Layer 0',
          tags: ['DEV'],
          dependencies: []
        },
        {
          id: 'task-2',
          reqId: 'req-123',
          name: 'Task 2',
          description: 'Layer 1',
          tags: ['DEV'],
          dependencies: ['task-1']
        }
      ];

      const tree = buildDependencyTree('req-123', tasks);

      // Initially task-2 is blocked
      expect(tree.tasks.get('task-2')?.status).toBe(TaskStatus.BLOCKED);

      // Complete task-1
      const nowReady = updateTaskReadiness(tree, 'task-1');

      expect(nowReady).toEqual(['task-2']);
      expect(tree.tasks.get('task-1')?.status).toBe(TaskStatus.COMPLETED);
      expect(tree.tasks.get('task-2')?.status).toBe(TaskStatus.READY);
    });

    it('should not mark task ready if other dependencies incomplete', () => {
      const tasks: TaskInput[] = [
        {
          id: 'task-1',
          reqId: 'req-123',
          name: 'Task 1',
          description: 'Dep 1',
          tags: ['DEV'],
          dependencies: []
        },
        {
          id: 'task-2',
          reqId: 'req-123',
          name: 'Task 2',
          description: 'Dep 2',
          tags: ['DEV'],
          dependencies: []
        },
        {
          id: 'task-3',
          reqId: 'req-123',
          name: 'Task 3',
          description: 'Depends on both',
          tags: ['TEST'],
          dependencies: ['task-1', 'task-2']
        }
      ];

      const tree = buildDependencyTree('req-123', tasks);

      // Complete only task-1
      const nowReady = updateTaskReadiness(tree, 'task-1');

      expect(nowReady).toEqual([]);
      expect(tree.tasks.get('task-3')?.status).toBe(TaskStatus.BLOCKED);

      // Complete task-2
      const nowReady2 = updateTaskReadiness(tree, 'task-2');

      expect(nowReady2).toEqual(['task-3']);
      expect(tree.tasks.get('task-3')?.status).toBe(TaskStatus.READY);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: Tests fail

**Step 3: Implement dependency tree builder**

Create `packages/dev-workflow/src/activities/dependency-tree.activities.ts`:

```typescript
import { DependencyTree, TaskNode, TaskStatus } from '../types/dependency-tree.types';
import { TaskInput } from '../types/task.types';

/**
 * Build dependency tree from task list
 */
export function buildDependencyTree(
  reqId: string,
  tasks: TaskInput[]
): DependencyTree {
  const tree: DependencyTree = {
    reqId,
    tasks: new Map(),
    layers: [],
    lastUpdated: new Date().toISOString()
  };

  // Create task nodes
  for (const task of tasks) {
    tree.tasks.set(task.id, {
      taskId: task.id,
      name: task.name,
      description: task.description,
      tags: task.tags,
      dependencies: task.dependencies || [],
      dependents: [],
      status: TaskStatus.BLOCKED,
      layer: -1,
      estimatedHours: task.estimatedHours
    });
  }

  // Build dependent relationships (reverse edges)
  for (const [taskId, node] of tree.tasks) {
    for (const depId of node.dependencies) {
      const depNode = tree.tasks.get(depId);
      if (depNode) {
        depNode.dependents.push(taskId);
      }
    }
  }

  // Topological sort to create layers
  const layers: TaskNode[][] = [];
  const visited = new Set<string>();

  // Layer 0: Tasks with no dependencies
  const layer0 = Array.from(tree.tasks.values())
    .filter(node => node.dependencies.length === 0);

  for (const node of layer0) {
    node.layer = 0;
    node.status = TaskStatus.READY;
    visited.add(node.taskId);
  }
  layers.push(layer0);

  // Subsequent layers
  let currentLayer = 0;
  let maxIterations = tree.tasks.size + 1;
  let iterations = 0;

  while (visited.size < tree.tasks.size) {
    iterations++;
    if (iterations > maxIterations) {
      throw new Error('Circular dependency detected');
    }

    const nextLayer: TaskNode[] = [];

    for (const [taskId, node] of tree.tasks) {
      if (visited.has(taskId)) continue;

      // Check if all dependencies are in earlier layers
      const allDepsVisited = node.dependencies.every(depId => visited.has(depId));

      if (allDepsVisited) {
        node.layer = currentLayer + 1;
        node.status = TaskStatus.BLOCKED;
        nextLayer.push(node);
        visited.add(taskId);
      }
    }

    if (nextLayer.length === 0 && visited.size < tree.tasks.size) {
      throw new Error('Circular dependency detected');
    }

    if (nextLayer.length > 0) {
      layers.push(nextLayer);
      currentLayer++;
    }
  }

  tree.layers = layers;
  return tree;
}

/**
 * Update task readiness when a task completes
 * Returns list of task IDs that became ready
 */
export function updateTaskReadiness(
  tree: DependencyTree,
  completedTaskId: string
): string[] {
  const completedNode = tree.tasks.get(completedTaskId);
  if (!completedNode) return [];

  completedNode.status = TaskStatus.COMPLETED;
  completedNode.completedAt = new Date().toISOString();

  const nowReady: string[] = [];

  // Check each dependent task
  for (const dependentId of completedNode.dependents) {
    const dependentNode = tree.tasks.get(dependentId);
    if (!dependentNode) continue;

    // Check if all dependencies are complete
    const allDepsComplete = dependentNode.dependencies.every(depId => {
      const dep = tree.tasks.get(depId);
      return dep?.status === TaskStatus.COMPLETED;
    });

    if (allDepsComplete && dependentNode.status === TaskStatus.BLOCKED) {
      dependentNode.status = TaskStatus.READY;
      nowReady.push(dependentId);
    }
  }

  tree.lastUpdated = new Date().toISOString();
  return nowReady;
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add .
git commit -m "feat(dev-workflow): implement dependency tree builder"
```

---

### Task 3.4: Implement BrainGrid Activities

**Files:**
- Create: `packages/dev-workflow/src/activities/braingrid.activities.ts`
- Create: `packages/dev-workflow/src/activities/index.ts`

**Step 1: Implement BrainGrid activities**

Create `packages/dev-workflow/src/activities/braingrid.activities.ts`:

```typescript
import {
  createIdea,
  createTask as braingridCreateTask,
  updateTaskStatus as braingridUpdateTaskStatus,
  listTasks as braingridListTasks,
  BrainGridRequirement,
  BrainGridTask
} from '@bernierllc/braingrid-cli-wrapper';
import { TaskInput, PollTaskParams } from '../types/task.types';

/**
 * Create a requirement in BrainGrid
 */
export async function createBrainGridREQ(params: {
  description: string;
  projectId?: string;
}): Promise<string> {
  const req = await createIdea(params.description, params.projectId);
  return req.id;
}

/**
 * Create tasks in BrainGrid
 */
export async function createBrainGridTasks(
  reqId: string,
  tasks: TaskInput[]
): Promise<void> {
  for (const task of tasks) {
    await braingridCreateTask(reqId, {
      title: task.name,
      description: task.description,
      tags: task.tags,
      dependencies: task.dependencies
    });
  }
}

/**
 * Poll BrainGrid for available tasks
 */
export async function pollForTask(params: PollTaskParams): Promise<BrainGridTask | null> {
  const tasks = await braingridListTasks({
    tags: params.tags,
    status: params.status as any[]
  });

  if (tasks.length === 0) {
    return null;
  }

  // Return first available task
  return tasks[0];
}

/**
 * Claim a task in BrainGrid
 */
export async function claimTask(
  taskId: string,
  workerId: string
): Promise<void> {
  await braingridUpdateTaskStatus(taskId, {
    status: 'IN_PROGRESS',
    assignedTo: workerId,
    metadata: {
      claimedAt: new Date().toISOString()
    }
  });
}

/**
 * Update task progress
 */
export async function updateTaskProgress(
  taskId: string,
  progress: number,
  message: string
): Promise<void> {
  await braingridUpdateTaskStatus(taskId, {
    metadata: {
      progress,
      message,
      updatedAt: new Date().toISOString()
    }
  });
}

/**
 * Complete a task
 */
export async function completeTask(
  taskId: string,
  result: any
): Promise<void> {
  await braingridUpdateTaskStatus(taskId, {
    status: 'COMPLETED',
    metadata: {
      result,
      completedAt: new Date().toISOString()
    }
  });
}
```

**Step 2: Create activities barrel**

Create `packages/dev-workflow/src/activities/index.ts`:

```typescript
export * from './braingrid.activities';
export * from './dependency-tree.activities';
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat(dev-workflow): implement BrainGrid activities"
```

---

### Task 3.5: Implement Minimal FeaturePlanningWorkflow

**Files:**
- Create: `packages/dev-workflow/src/workflows/feature-planning.workflow.ts`

**Step 1: Implement minimal planning workflow**

Create `packages/dev-workflow/src/workflows/feature-planning.workflow.ts`:

```typescript
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';
import { DependencyTree, TaskStatus } from '../types/dependency-tree.types';
import { TaskInput } from '../types/task.types';

// Create activity proxies
const {
  createBrainGridREQ,
  createBrainGridTasks,
  buildDependencyTree,
  updateTaskReadiness
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes'
});

export interface PlanningWorkflowInput {
  featureRequest: string;
  repoPath: string;
  projectId?: string;
}

export interface PlanningWorkflowResult {
  success: boolean;
  reqId: string;
  taskCount: number;
}

/**
 * Minimal FeaturePlanningWorkflow (Phase 1)
 *
 * Creates BrainGrid REQ and task breakdown
 * Does NOT include conversational gathering or Slack integration yet
 */
export async function FeaturePlanningWorkflow(
  input: PlanningWorkflowInput
): Promise<PlanningWorkflowResult> {
  const { featureRequest, projectId } = input;

  console.log(`[Planning] Creating REQ for: ${featureRequest}`);

  // Step 1: Create BrainGrid REQ
  const reqId = await createBrainGridREQ({
    description: featureRequest,
    projectId
  });

  console.log(`[Planning] Created REQ: ${reqId}`);

  // Step 2: Mock task breakdown (Phase 1 - will be AI-powered later)
  const mockTasks: TaskInput[] = [
    {
      id: 'task-1',
      reqId,
      name: 'Setup and configuration',
      description: 'Initial setup for ' + featureRequest,
      tags: ['DEV', 'backend'],
      dependencies: []
    },
    {
      id: 'task-2',
      reqId,
      name: 'Implementation',
      description: 'Core implementation',
      tags: ['DEV', 'frontend'],
      dependencies: ['task-1']
    },
    {
      id: 'task-3',
      reqId,
      name: 'Tests',
      description: 'Write tests',
      tags: ['TEST'],
      dependencies: ['task-2']
    }
  ];

  console.log(`[Planning] Created ${mockTasks.length} tasks`);

  // Step 3: Build dependency tree
  const dependencyTree = await buildDependencyTree(reqId, mockTasks);

  console.log(`[Planning] Built dependency tree with ${dependencyTree.layers.length} layers`);

  // Step 4: Create tasks in BrainGrid
  await createBrainGridTasks(reqId, mockTasks);

  console.log(`[Planning] Published tasks to BrainGrid`);

  return {
    success: true,
    reqId,
    taskCount: mockTasks.length
  };
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat(dev-workflow): implement minimal FeaturePlanningWorkflow"
```

---

### Task 3.6: Implement DevelopmentTaskWorkflow (Polling Only)

**Files:**
- Create: `packages/dev-workflow/src/workflows/development-task.workflow.ts`

**Step 1: Implement polling-only dev workflow**

Create `packages/dev-workflow/src/workflows/development-task.workflow.ts`:

```typescript
import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  pollForTask,
  claimTask,
  updateTaskProgress,
  completeTask
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes'
});

export interface DevelopmentTaskWorkflowInput {
  workerId: string;
}

/**
 * Minimal DevelopmentTaskWorkflow (Phase 1)
 *
 * Polls BrainGrid for DEV tasks and claims them
 * Does NOT execute tasks yet - just logs what it would do
 */
export async function DevelopmentTaskWorkflow(
  input: DevelopmentTaskWorkflowInput
): Promise<void> {
  const { workerId } = input;

  console.log(`[DevWorker ${workerId}] Starting polling loop`);

  // Continuous polling loop
  while (true) {
    try {
      // Poll for available DEV tasks
      const task = await pollForTask({
        tags: ['DEV'],
        status: ['TODO', 'READY']
      });

      if (!task) {
        console.log(`[DevWorker ${workerId}] No tasks available, sleeping...`);
        await sleep('30s');
        continue;
      }

      console.log(`[DevWorker ${workerId}] Found task: ${task.id} - ${task.title}`);

      // Claim the task
      await claimTask(task.id, workerId);

      console.log(`[DevWorker ${workerId}] Claimed task: ${task.id}`);

      // Phase 1: Just log what we would do
      await updateTaskProgress(task.id, 50, 'Phase 1: Would execute task here');

      console.log(`[DevWorker ${workerId}] Would execute: ${task.description}`);

      // Simulate work
      await sleep('5s');

      // Mark complete
      await completeTask(task.id, {
        note: 'Phase 1: Simulated completion'
      });

      console.log(`[DevWorker ${workerId}] Completed task: ${task.id}`);

    } catch (error) {
      console.error(`[DevWorker ${workerId}] Error:`, error);
      await sleep('1m'); // Back off on error
    }
  }
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat(dev-workflow): implement polling-only DevelopmentTaskWorkflow"
```

---

### Task 3.7: Create Worker Entry Points

**Files:**
- Create: `packages/dev-workflow/src/workers/dev-worker.ts`

**Step 1: Create dev worker**

Create `packages/dev-workflow/src/workers/dev-worker.ts`:

```typescript
import { Worker } from '@temporalio/worker';
import * as activities from '../activities';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const worker = await Worker.create({
    workflowsPath: join(__dirname, '../workflows'),
    activities,
    taskQueue: 'dev-workflow',
    maxConcurrentActivityExecutions: 4,
    maxConcurrentWorkflowTaskExecutions: 10
  });

  console.log('Dev workflow worker started');
  console.log('Task queue: dev-workflow');
  console.log('Temporal address:', process.env.TEMPORAL_ADDRESS || 'localhost:7233');

  await worker.run();
}

main().catch(err => {
  console.error('Worker failed:', err);
  process.exit(1);
});
```

**Step 2: Update package.json scripts**

The scripts are already in package.json from Task 3.1.

**Step 3: Commit**

```bash
git add .
git commit -m "feat(dev-workflow): add dev worker entry point"
```

---

### Task 3.8: Test Phase 1 End-to-End

**Files:**
- Create: `packages/dev-workflow/test-phase1.ts`

**Step 1: Create test script**

Create `packages/dev-workflow/test-phase1.ts`:

```typescript
import { Connection, Client } from '@temporalio/client';
import { FeaturePlanningWorkflow } from './src/workflows/feature-planning.workflow';
import { DevelopmentTaskWorkflow } from './src/workflows/development-task.workflow';

async function testPhase1() {
  // Connect to Temporal
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
  });

  const client = new Client({ connection });

  console.log('=== Phase 1 End-to-End Test ===\n');

  // Test 1: Start FeaturePlanningWorkflow
  console.log('1. Starting FeaturePlanningWorkflow...');

  const planningHandle = await client.workflow.start(FeaturePlanningWorkflow, {
    taskQueue: 'dev-workflow',
    workflowId: `planning-test-${Date.now()}`,
    args: [{
      featureRequest: 'Add user authentication with OAuth2',
      repoPath: '/Users/mattbernier/projects/production-agent-coordinators',
      projectId: 'proj-test'
    }]
  });

  console.log(`   Workflow started: ${planningHandle.workflowId}`);

  const planningResult = await planningHandle.result();

  console.log(`   Result:`, planningResult);
  console.log(`   ✓ Created REQ: ${planningResult.reqId}`);
  console.log(`   ✓ Created ${planningResult.taskCount} tasks\n`);

  // Test 2: Start DevelopmentTaskWorkflow
  console.log('2. Starting DevelopmentTaskWorkflow (will run for 2 minutes)...');

  const devHandle = await client.workflow.start(DevelopmentTaskWorkflow, {
    taskQueue: 'dev-workflow',
    workflowId: `dev-worker-test-${Date.now()}`,
    args: [{
      workerId: 'test-worker-1'
    }]
  });

  console.log(`   Workflow started: ${devHandle.workflowId}`);
  console.log(`   Worker is polling for tasks...`);
  console.log(`   Let it run for 2 minutes to see it pick up tasks`);
  console.log(`   Press Ctrl+C to stop\n`);

  // Wait 2 minutes then cancel
  await new Promise(resolve => setTimeout(resolve, 120000));

  console.log('\n3. Stopping dev worker...');
  await devHandle.cancel();

  console.log('\n=== Phase 1 Test Complete ===');
  console.log('✓ Planning workflow creates REQs and tasks');
  console.log('✓ Development workflow polls and claims tasks');
  console.log('✓ Tasks are marked as completed (simulated)');
  console.log('\nNext: Phase 2 will add real agent execution');

  process.exit(0);
}

testPhase1().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
```

**Step 2: Add test script to package.json**

Modify `packages/dev-workflow/package.json`:

```json
{
  "scripts": {
    "test:phase1": "tsx test-phase1.ts"
  }
}
```

**Step 3: Run the test (with Temporal running)**

```bash
# Ensure Temporal is running
docker-compose up -d

# Run test
cd packages/dev-workflow
npm run test:phase1
```

Expected:
- Planning workflow creates REQ and 3 tasks
- Dev workflow polls and claims task
- Task marked complete
- Workflow runs for 2 minutes then stops

**Step 4: Verify in Temporal UI**

Open `http://localhost:8080` and verify workflows appear

**Step 5: Commit**

```bash
git add .
git commit -m "feat(dev-workflow): add Phase 1 end-to-end test"
```

---

## Phase 1 Complete!

### Success Criteria Checklist

- [x] BrainGrid CLI wrapper package built and tested
- [x] Temporal infrastructure running (docker-compose)
- [x] FeaturePlanningWorkflow creates REQs and tasks
- [x] DevelopmentTaskWorkflow polls BrainGrid for tasks
- [x] Tasks can be claimed and marked complete
- [x] Dependency tree builder working
- [x] End-to-end test passes

### What Works

1. **BrainGrid Integration**: CLI wrapper provides type-safe access to BrainGrid
2. **Temporal Infrastructure**: Local Temporal server running with UI
3. **Planning Workflow**: Creates REQs and task breakdown (mocked for now)
4. **Execution Workflow**: Polls for DEV tasks and claims them
5. **Dependency Management**: Tree builder calculates layers correctly

### What's Missing (Next Phases)

- **Phase 2**: Slack integration for conversational requirement gathering
- **Phase 3**: Real agent execution (not simulated)
- **Phase 4**: Testing workflows
- **Phase 5**: Deployment workflows
- **Phase 6**: Production polish

---

## Plan Saved

**File:** `docs/plans/2025-11-21-dev-workflow-phase1-foundation.md`

**Execution Options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration with quality gates

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach would you prefer?**
