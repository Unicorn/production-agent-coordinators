# Project Connections

## Overview

Project Connections allow you to manage database and service connections at the project level. These connections can be reused across multiple workflows in the same project, making it easy to connect to PostgreSQL databases, Redis instances, and other services.

## Features

- **Project-Level Storage**: Connections are stored per project, not globally
- **Multiple Connections**: Create multiple connections of the same type (e.g., multiple PostgreSQL databases)
- **Connection Testing**: Test connections before using them in workflows
- **Secure Storage**: Connection URLs are stored securely (encryption recommended for production)
- **Reusable**: Use the same connection across multiple workflows in a project

## Supported Connection Types

### PostgreSQL

Connect to PostgreSQL databases using connection strings:
```
postgresql://user:password@host:port/database
```

**Usage**: Used by the PostgreSQL Query component to execute SQL queries.

### Redis

Connect to Redis instances using connection strings:
```
redis://user:password@host:port
```

**Usage**: Used by the Redis Command component to execute Redis commands.

## Creating Connections

### Via UI

1. Navigate to a project detail page
2. Click the "Connections" tab
3. Click "Add Connection"
4. Select connection type (PostgreSQL or Redis)
5. Enter a name for the connection (e.g., "Production DB", "Cache Server")
6. Enter the connection URL
7. Click "Create"

### Connection Naming

Choose descriptive names that indicate the purpose:
- `Production PostgreSQL`
- `Staging Redis Cache`
- `Analytics Database`
- `Session Store`

## Managing Connections

### Testing Connections

After creating a connection, you can test it:
1. Click the "Test" button next to a connection
2. The system will attempt to connect and verify connectivity
3. Results are displayed immediately (success or error message)

### Editing Connections

1. Click the "Edit" button (pencil icon) next to a connection
2. Update the name or connection URL
3. Click "Save"

### Deleting Connections

1. Click the "Delete" button (trash icon) next to a connection
2. Confirm deletion
3. **Note**: Deleting a connection will break any workflows using it

## Using Connections in Workflows

### PostgreSQL Component

1. Add a PostgreSQL Query node to your workflow
2. In the node properties panel:
   - Select a connection from the dropdown
   - Enter your SQL query (with parameter placeholders: `$1`, `$2`, etc.)
   - Optionally provide query parameters as a JSON array
   - Configure retry policy if needed
3. The component will use the selected connection to execute the query

### Redis Component

1. Add a Redis Command node to your workflow
2. In the node properties panel:
   - Select a connection from the dropdown
   - Choose a command (GET, SET, DEL, EXISTS, INCR, DECR)
   - Enter the key
   - For SET commands, enter the value
   - Configure retry policy if needed
3. The component will use the selected connection to execute the command

## Security Best Practices

### Connection URLs

- **Never commit connection URLs to version control**
- Use environment variables or secure secret management in production
- Consider encrypting connection URLs in the database
- Use connection pooling when possible
- Implement network-level security (VPC, firewall rules)

### Access Control

- Connections are scoped to projects
- Only users with access to a project can see its connections
- Row Level Security (RLS) policies ensure data isolation

### Credentials

- Use strong passwords
- Rotate credentials regularly
- Use read-only database users when possible
- Consider using connection string parameters for SSL/TLS

## Database Schema

Connections are stored in the `project_connections` table:

- `id`: Unique connection ID
- `project_id`: Project this connection belongs to
- `connection_type`: Type of connection (postgresql, redis)
- `name`: User-friendly name
- `connection_url`: The actual connection string
- `config`: Additional configuration (JSON)
- `created_by`: User who created the connection
- `created_at`, `updated_at`: Timestamps

See migration: `20251118000006_execution_monitoring_tables.sql`

## API

Connections are managed via tRPC:

- `connections.list`: List all connections for a project
- `connections.create`: Create a new connection
- `connections.update`: Update an existing connection
- `connections.delete`: Delete a connection
- `connections.test`: Test a connection

## Troubleshooting

### Connection Test Fails

1. **Check the connection URL format**: Ensure it matches the expected format for the connection type
2. **Verify network access**: Ensure the workflow worker can reach the database/service
3. **Check credentials**: Verify username and password are correct
4. **Firewall rules**: Ensure the database/service allows connections from the worker
5. **SSL/TLS**: Some databases require SSL - add `?sslmode=require` to PostgreSQL URLs

### Connection Works in Test but Fails in Workflow

1. **Worker network**: The worker may be running in a different network context
2. **Connection pooling**: The connection might be timing out - check connection pool settings
3. **Retry policy**: Configure retry policies on the component to handle transient failures

## Future Enhancements

- Connection pooling configuration
- Connection health monitoring
- Connection usage tracking (which workflows use which connections)
- Encrypted connection URL storage
- Support for additional connection types (MySQL, MongoDB, etc.)
- Connection templates for common configurations
- Automatic connection rotation

