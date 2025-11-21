# Error Handling Implementation Guide

This guide demonstrates how to use the comprehensive error handling system across the Workflow Builder application.

## Table of Contents

1. [Overview](#overview)
2. [Error Classes](#error-classes)
3. [Server-Side Error Handling](#server-side-error-handling)
4. [Client-Side Error Handling](#client-side-error-handling)
5. [Error Logging](#error-logging)
6. [Best Practices](#best-practices)

---

## Overview

The error handling system provides:

- **Custom Error Classes** - Specific error types with user-friendly messages
- **Error Handler Middleware** - Automatic error conversion and logging
- **Error Boundaries** - React components that catch rendering errors
- **Error Logging** - Centralized logging to console and database
- **Validation System** - Enhanced workflow validation with detailed errors

---

## Error Classes

### Available Error Types

```typescript
import {
  ValidationError,
  CompilationError,
  ExecutionError,
  TimeoutError,
  NetworkError,
  DatabaseError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
} from '@/lib/errors';
```

### Creating Custom Errors

```typescript
// Validation Error
throw new ValidationError({
  message: 'Invalid email format',
  field: 'email',
  invalidValue: userInput.email,
  recoverySuggestions: [
    'Use a valid email address (e.g., user@example.com)',
    'Check for typos in the email address',
  ],
});

// Compilation Error
throw new CompilationError({
  message: 'Missing component reference',
  nodeId: 'activity-123',
  compilationPhase: 'validation',
  recoverySuggestions: [
    'Select a component from the component library',
    'Ensure the component is published',
  ],
});

// Execution Error
throw new ExecutionError({
  message: 'Activity execution failed',
  workflowId: 'wf-abc',
  executionId: 'exec-xyz',
  failedStep: 'send-email',
  recoverySuggestions: [
    'Check the email service configuration',
    'Verify SMTP credentials are correct',
    'Review execution logs for details',
  ],
  originalError: error, // Original error for logging
});

// Timeout Error
throw new TimeoutError({
  message: 'Database query took too long',
  timeoutMs: 30000,
  operation: 'workflow-list-query',
  recoverySuggestions: [
    'Increase timeout to 60000ms',
    'Add database indexes',
    'Reduce query complexity',
  ],
});
```

---

## Server-Side Error Handling

### In tRPC Routers

```typescript
import { createTRPCRouter, protectedProcedure } from '../trpc';
import {
  handleError,
  validateInput,
  requireAuthorization,
  withDatabaseErrorHandling,
} from '@/lib/errors';

export const workflowsRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        // Validate input
        validateInput(
          input.id.length > 0,
          'id',
          'Workflow ID cannot be empty',
          input.id,
          ['Provide a valid workflow ID']
        );

        // Database operation with error handling
        const workflow = await withDatabaseErrorHandling(
          () =>
            ctx.supabase
              .from('workflows')
              .select('*')
              .eq('id', input.id)
              .single(),
          'select',
          'workflows'
        );

        // Check authorization
        requireAuthorization(
          workflow.created_by === ctx.user.id,
          'workflow',
          workflow.id,
          'read'
        );

        return { workflow };
      } catch (error) {
        // Convert and throw as tRPC error
        handleError(error);
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        kebabName: z.string(),
        displayName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check for conflicts
        const { data: existing } = await ctx.supabase
          .from('workflows')
          .select('id')
          .eq('kebab_name', input.kebabName)
          .eq('created_by', ctx.user.id)
          .single();

        if (existing) {
          throw new ConflictError({
            message: 'A workflow with this name already exists',
            conflictType: 'duplicate-name',
            recoverySuggestions: [
              'Choose a different workflow name',
              'Archive or delete the existing workflow',
            ],
          });
        }

        // Create workflow
        const workflow = await withDatabaseErrorHandling(
          () =>
            ctx.supabase
              .from('workflows')
              .insert({
                kebab_name: input.kebabName,
                display_name: input.displayName,
                created_by: ctx.user.id,
              })
              .select()
              .single(),
          'insert',
          'workflows'
        );

        return workflow;
      } catch (error) {
        handleError(error);
      }
    }),
});
```

### Using Error Boundary for Multiple Operations

```typescript
import { ErrorBoundary } from '@/lib/errors';

export const processingRouter = createTRPCRouter({
  processWorkflow: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const boundary = new ErrorBoundary();

      // Attempt multiple operations, collecting errors
      const workflow = await boundary.try(() =>
        fetchWorkflow(input.workflowId)
      );

      const validation = await boundary.try(() => validateWorkflow(workflow));

      const compilation = await boundary.try(() => compileWorkflow(workflow));

      // Add warnings
      if (workflow?.nodes.length > 50) {
        boundary.warn('Workflow has many nodes, may be slow to compile');
      }

      // Check for errors before proceeding
      if (boundary.hasErrors()) {
        const summary = boundary.getSummary();
        throw new CompilationError({
          message: `Failed with ${summary.errorCount} error(s)`,
          details: summary,
        });
      }

      // All operations succeeded
      return {
        success: true,
        warnings: boundary.getWarnings(),
      };
    }),
});
```

### Network Requests with Retry

```typescript
import { withRetry, withNetworkErrorHandling } from '@/lib/errors';

async function callExternalAPI(url: string, data: any) {
  return withRetry(
    async () => {
      return withNetworkErrorHandling(
        () =>
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }),
        url
      );
    },
    {
      maxAttempts: 3,
      timeoutMs: 30000,
      retryDelayMs: 1000,
      operationName: 'external-api-call',
    }
  );
}
```

---

## Client-Side Error Handling

### Using Error Boundary in React

```typescript
import { ErrorBoundary, WorkflowErrorBoundary } from '@/components/workflow/ErrorBoundary';

// Wrap entire app or specific sections
export default function App() {
  return (
    <ErrorBoundary>
      <MainContent />
    </ErrorBoundary>
  );
}

// Use workflow-specific error boundary
export function WorkflowBuilder() {
  return (
    <WorkflowErrorBoundary>
      <WorkflowCanvas />
      <NodeProperties />
    </WorkflowErrorBoundary>
  );
}

// Custom fallback UI
export function CustomErrorPage() {
  return (
    <ErrorBoundary
      fallback={(error, errorInfo, reset) => (
        <div>
          <h1>Oops! Something went wrong</h1>
          <p>{error.message}</p>
          <button onClick={reset}>Try Again</button>
        </div>
      )}
      onError={(error, errorInfo) => {
        // Send to monitoring service
        logErrorToService(error, errorInfo);
      }}
    >
      <YourComponent />
    </ErrorBoundary>
  );
}
```

### Programmatic Error Throwing

```typescript
import { useErrorBoundary } from '@/components/workflow/ErrorBoundary';

function MyComponent() {
  const throwError = useErrorBoundary();

  const handleAction = async () => {
    try {
      await riskyOperation();
    } catch (error) {
      // Trigger error boundary
      throwError(error as Error);
    }
  };

  return <button onClick={handleAction}>Do Something</button>;
}
```

### Handling tRPC Errors

```typescript
import { api } from '@/lib/api';
import { toast } from '@/components/ui/toast';

function WorkflowList() {
  const { data, error, refetch } = api.workflows.list.useQuery();

  if (error) {
    // Error includes user message and suggestions
    const errorData = error.data as any;

    return (
      <div className="error-container">
        <h3>Error Loading Workflows</h3>
        <p>{error.message}</p>

        {errorData?.cause?.suggestions && (
          <div className="suggestions">
            <h4>What you can try:</h4>
            <ul>
              {errorData.cause.suggestions.map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  return <div>{/* Render workflows */}</div>;
}

// Show toast notifications for errors
function useWorkflowMutation() {
  const createMutation = api.workflows.create.useMutation({
    onError: (error) => {
      const errorData = error.data as any;

      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });

      // Show suggestions as additional toast if available
      if (errorData?.cause?.suggestions?.length > 0) {
        toast({
          title: 'Suggestions',
          description: errorData.cause.suggestions[0],
          variant: 'default',
        });
      }
    },
  });

  return createMutation;
}
```

---

## Error Logging

### Setting Up Error Logging

```typescript
// In app initialization (e.g., app/layout.tsx or server startup)
import {
  setGlobalErrorLogger,
  DatabaseErrorLogger,
  ConsoleErrorLogger,
  CompositeErrorLogger,
} from '@/lib/errors';
import { createClient } from '@supabase/supabase-js';

// Development: console only
if (process.env.NODE_ENV === 'development') {
  setGlobalErrorLogger(new ConsoleErrorLogger());
}

// Production: console + database
if (process.env.NODE_ENV === 'production') {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  setGlobalErrorLogger(
    new CompositeErrorLogger([
      new ConsoleErrorLogger(),
      new DatabaseErrorLogger(supabase),
    ])
  );
}
```

### Using the Logger

```typescript
import { logger } from '@/lib/errors';

// Log different severity levels
logger.debug('Debug information', { userId: '123' });
logger.info('User action completed', { action: 'workflow-created' });
logger.warn('Unusual activity detected', { attempts: 5 });
logger.error('Operation failed', { operation: 'compile', error: err });
logger.critical('System failure', { service: 'database' });

// Log WorkflowError instances
try {
  await operation();
} catch (error) {
  if (error instanceof WorkflowError) {
    logger.logWorkflowError(error, {
      context: 'workflow-compilation',
      userId: user.id,
    });
  }
}
```

### Client-Side Error Logging

```typescript
// In app/layout.tsx or root component
useEffect(() => {
  // Global error handler
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);

    // Send to monitoring service
    fetch('/api/log-error', {
      method: 'POST',
      body: JSON.stringify({
        message: event.error.message,
        stack: event.error.stack,
        url: window.location.href,
      }),
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);

    fetch('/api/log-error', {
      method: 'POST',
      body: JSON.stringify({
        message: event.reason.message || String(event.reason),
        stack: event.reason.stack,
        url: window.location.href,
      }),
    });
  });
}, []);
```

---

## Best Practices

### 1. Always Provide User-Friendly Messages

```typescript
// ❌ Bad
throw new Error('FK constraint violation');

// ✅ Good
throw new ValidationError({
  message: 'Cannot delete workflow because it has active executions',
  field: 'workflow',
  recoverySuggestions: [
    'Stop all running executions first',
    'Archive the workflow instead of deleting',
  ],
});
```

### 2. Include Recovery Suggestions

```typescript
// ❌ Bad
throw new TimeoutError({
  message: 'Timeout',
  timeoutMs: 30000,
  operation: 'api-call',
});

// ✅ Good
throw new TimeoutError({
  message: 'External API call timed out',
  timeoutMs: 30000,
  operation: 'api-call',
  recoverySuggestions: [
    'Increase timeout to 60000ms in configuration',
    'Check if external service is responding slowly',
    'Verify network connectivity',
  ],
});
```

### 3. Never Expose Sensitive Information

```typescript
// ❌ Bad - exposes database details
throw new Error(`Database error: ${dbError.message}`);

// ✅ Good - generic user message, detailed server logs
throw new DatabaseError({
  message: dbError.message, // Logged server-side only
  operation: 'insert',
  table: 'workflows',
  originalError: dbError,
});
// User sees: "A database error occurred. Please try again later."
```

### 4. Use Appropriate Error Types

```typescript
// ❌ Bad - generic error
if (!workflow) {
  throw new Error('Not found');
}

// ✅ Good - specific error type
if (!workflow) {
  throw new NotFoundError({
    message: 'Workflow not found',
    resourceType: 'Workflow',
    resourceId: workflowId,
  });
}
```

### 5. Log All Errors Server-Side

```typescript
// ❌ Bad - error not logged
try {
  await operation();
} catch (error) {
  throw error; // Not logged!
}

// ✅ Good - error logged before throwing
try {
  await operation();
} catch (error) {
  logger.error('Operation failed', {
    operation: 'workflow-compile',
    error: error.message,
  });
  handleError(error);
}
```

### 6. Validate Early

```typescript
// ❌ Bad - validation after processing
async function createWorkflow(data: any) {
  const workflow = await processData(data);
  if (!data.name) throw new Error('Name required');
  return saveWorkflow(workflow);
}

// ✅ Good - validate before processing
async function createWorkflow(data: any) {
  validateInput(!!data.name, 'name', 'Workflow name is required');
  validateInput(data.name.length <= 255, 'name', 'Name too long');

  const workflow = await processData(data);
  return saveWorkflow(workflow);
}
```

### 7. Use Error Boundaries Strategically

```typescript
// ✅ Good - wrap sections that might fail
<Layout>
  <ErrorBoundary>
    <WorkflowList /> {/* Might fail to load */}
  </ErrorBoundary>

  <ErrorBoundary>
    <ExecutionMonitor /> {/* Independent section */}
  </ErrorBoundary>
</Layout>
```

### 8. Provide Context in Error Details

```typescript
// ❌ Bad - no context
throw new CompilationError({
  message: 'Compilation failed',
});

// ✅ Good - includes context
throw new CompilationError({
  message: 'Cannot compile node without component reference',
  nodeId: node.id,
  compilationPhase: 'validation',
  details: {
    nodeType: node.type,
    nodeLabel: node.data.label,
    workflowId: workflow.id,
  },
});
```

---

## Error Monitoring Dashboard

Create an admin page to view error metrics:

```typescript
import { api } from '@/lib/api';
import { calculateErrorMetrics } from '@/lib/errors';

function ErrorMonitoringPage() {
  const { data: errorLogs } = api.admin.getErrorLogs.useQuery({
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
  });

  const metrics = errorLogs ? calculateErrorMetrics(errorLogs) : null;

  return (
    <div>
      <h1>Error Monitoring</h1>

      {metrics && (
        <>
          <div>Total Errors: {metrics.totalErrors}</div>

          <h2>By Severity</h2>
          <ul>
            {Object.entries(metrics.errorsBySeverity).map(([severity, count]) => (
              <li key={severity}>
                {severity}: {count}
              </li>
            ))}
          </ul>

          <h2>Top Errors</h2>
          <ul>
            {metrics.topErrors.map((error, i) => (
              <li key={i}>
                {error.message} ({error.count} times)
              </li>
            ))}
          </ul>

          <h2>By Error Code</h2>
          <ul>
            {Object.entries(metrics.errorsByCode).map(([code, count]) => (
              <li key={code}>
                {code}: {count}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

---

## Testing Error Handling

```typescript
import { ValidationError } from '@/lib/errors';

describe('Workflow Creation', () => {
  it('should throw ValidationError for duplicate names', async () => {
    const createWorkflow = api.workflows.create.useMutation();

    await expect(
      createWorkflow.mutateAsync({
        kebabName: 'existing-workflow',
        displayName: 'Test',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('should include recovery suggestions', async () => {
    try {
      await createWorkflow({ name: '' });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.recoverySuggestions.length).toBeGreaterThan(0);
    }
  });
});
```

---

For more information, see:
- [Common Errors Guide](../troubleshooting/common-errors.md)
- [API Reference](../api-reference/README.md)
- [Testing Guide](./testing-guide.md)
