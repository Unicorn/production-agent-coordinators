# Database and Processing Components

## Overview

Three new components have been added to enable database operations and data processing within workflows:

1. **PostgreSQL Query**: Execute parameterized SQL queries
2. **Redis Command**: Execute Redis commands (GET, SET, DEL, etc.)
3. **TypeScript Processor**: Process and transform data using TypeScript code

## PostgreSQL Query Component

### Purpose

Execute SQL queries against PostgreSQL databases with parameter support and configurable retry policies.

### Configuration

**Required Settings**:
- **Connection**: Select a project connection (PostgreSQL type)
- **Query**: SQL query with parameter placeholders (`$1`, `$2`, etc.)

**Optional Settings**:
- **Parameters**: JSON array of parameter values (e.g., `["value1", 123]`)
- **Retry Policy**: Configure how to handle failures

### Example Queries

**Simple SELECT**:
```sql
SELECT * FROM users WHERE id = $1
```
Parameters: `["123"]`

**INSERT with Multiple Parameters**:
```sql
INSERT INTO orders (user_id, product_id, quantity) VALUES ($1, $2, $3)
```
Parameters: `["user-123", "prod-456", 2]`

**UPDATE**:
```sql
UPDATE users SET status = $1 WHERE id = $2
```
Parameters: `["active", "user-123"]`

### Output

The component returns:
```json
{
  "success": true,
  "rows": [...],  // Array of result rows
  "rowCount": 5   // Number of rows affected/returned
}
```

On error:
```json
{
  "success": false,
  "error": "Error message"
}
```

### Retry Policies

Recommended retry policies for database queries:
- **Exponential Backoff**: For transient network issues
- **Keep Trying**: For critical operations that must succeed
- **Fail After X**: For operations where eventual consistency is acceptable

## Redis Command Component

### Purpose

Execute Redis commands for caching, session storage, and other key-value operations.

### Supported Commands

- **GET**: Retrieve a value by key
- **SET**: Store a value with a key
- **DEL**: Delete a key
- **EXISTS**: Check if a key exists
- **INCR**: Increment a numeric value
- **DECR**: Decrement a numeric value

### Configuration

**Required Settings**:
- **Connection**: Select a project connection (Redis type)
- **Command**: Choose from the command dropdown
- **Key**: The Redis key to operate on

**Optional Settings**:
- **Value**: Required for SET command
- **Retry Policy**: Configure how to handle failures

### Examples

**GET a value**:
- Command: GET
- Key: `user:123:profile`
- Returns: The stored value or null

**SET a value**:
- Command: SET
- Key: `session:abc123`
- Value: `{"userId": "123", "expires": "2024-01-01"}`
- Returns: Success status

**INCR a counter**:
- Command: INCR
- Key: `page:views:home`
- Returns: New counter value

### Output

The component returns:
```json
{
  "success": true,
  "result": "value"  // Command result (varies by command)
}
```

On error:
```json
{
  "success": false,
  "error": "Error message"
}
```

### Retry Policies

Recommended retry policies for Redis:
- **Exponential Backoff**: For transient network issues
- **Keep Trying**: For critical cache operations
- **No Retries**: For non-critical operations where stale data is acceptable

## TypeScript Processor Component

### Purpose

Process and transform data using custom TypeScript code. Useful for:
- Data transformation between workflow steps
- Complex calculations
- Data validation
- Format conversion

### Configuration

**Required Settings**:
- **Code**: TypeScript code that exports a `process` function

**Optional Settings**:
- **Input Schema**: JSON schema for input validation
- **Output Schema**: JSON schema for output validation

### Code Structure

Your code must export a function named `process`:

```typescript
export async function process(input: any): Promise<any> {
  // Your code here
  return transformedData;
}
```

### Examples

**Simple Transformation**:
```typescript
export async function process(input: any): Promise<any> {
  return {
    ...input,
    processedAt: new Date().toISOString(),
    status: 'processed'
  };
}
```

**Data Aggregation**:
```typescript
export async function process(input: any): Promise<any> {
  const orders = input.orders || [];
  return {
    totalOrders: orders.length,
    totalValue: orders.reduce((sum, o) => sum + o.value, 0),
    averageValue: orders.length > 0 
      ? orders.reduce((sum, o) => sum + o.value, 0) / orders.length 
      : 0
  };
}
```

**Data Filtering**:
```typescript
export async function process(input: any): Promise<any> {
  const users = input.users || [];
  return {
    activeUsers: users.filter(u => u.status === 'active'),
    inactiveUsers: users.filter(u => u.status !== 'active')
  };
}
```

### Input/Output

The component receives:
- **Input**: Data from the previous workflow step (or workflow input)

The component returns:
```json
{
  "success": true,
  "output": {...}  // Your processed data
}
```

On error:
```json
{
  "success": false,
  "error": "Error message"
}
```

### Security Considerations

⚠️ **Warning**: The TypeScript Processor executes user-provided code. In production:
- Implement proper sandboxing (e.g., using `vm2` or `isolated-vm`)
- Set execution timeouts
- Limit resource usage (CPU, memory)
- Validate code before execution
- Consider code review for sensitive workflows

The current implementation is a placeholder and should be enhanced for production use.

## Workflow Patterns

### Database Query → Process → Store

1. **PostgreSQL Query**: Fetch data from database
2. **TypeScript Processor**: Transform/aggregate the data
3. **Redis SET**: Cache the processed result

### Cache-Aside Pattern

1. **Redis GET**: Try to get from cache
2. **Condition Node**: Check if cache hit
3. **If miss**: PostgreSQL Query → Redis SET
4. **If hit**: Use cached value

### Data Pipeline

1. **PostgreSQL Query**: Fetch raw data
2. **TypeScript Processor**: Clean and transform
3. **TypeScript Processor**: Calculate metrics
4. **PostgreSQL Query**: Store results

## Best Practices

### Error Handling

- Always configure retry policies for database operations
- Use exponential backoff for transient failures
- Consider "keep trying" for critical operations
- Handle errors in TypeScript processors with try/catch

### Performance

- Use parameterized queries (prevents SQL injection and improves performance)
- Cache frequently accessed data in Redis
- Use TypeScript processors for lightweight transformations
- Consider batch operations for multiple database queries

### Security

- Never include credentials in queries or code
- Use project connections for database access
- Validate input data in TypeScript processors
- Use parameterized queries to prevent SQL injection
- Sanitize user input before processing

## Component Registration

These components are automatically registered in the database via seed migration:
- `20251118000007_seed_sync_workflow_and_components.sql`

They appear in the component palette as:
- **PostgreSQL Query** (Activity type)
- **Redis Command** (Activity type)
- **TypeScript Processor** (Activity type)

## Future Enhancements

- Additional database types (MySQL, MongoDB, etc.)
- Query builder UI for PostgreSQL
- Redis pipeline support
- TypeScript processor code editor with syntax highlighting
- Pre-built transformation functions library
- Connection pooling configuration
- Query result caching
- Batch operations support

