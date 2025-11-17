# Security

Security architecture and patterns for the Workflow Builder system.

## Overview

The system implements multiple layers of security:
- **Authentication**: Supabase Auth with JWT tokens
- **Authorization**: Row-Level Security (RLS) policies
- **Input Validation**: Zod schemas on all inputs
- **Data Isolation**: Multi-tenant isolation via RLS

## Authentication

### Supabase Auth

**Implementation**: Supabase Auth handles all authentication.

**Features**:
- Email/password authentication
- JWT token-based sessions
- httpOnly cookies for session storage
- Auto-refresh tokens

**Flow**:
1. User signs up/signs in via Supabase Auth
2. Supabase returns JWT token
3. Token stored in httpOnly cookie
4. Token included in all API requests
5. Backend validates token via Supabase client

### Session Management

**Client-Side**:
- Supabase client manages session
- Auto-refreshes expired tokens
- Handles sign out

**Server-Side**:
- tRPC middleware extracts user from token
- User ID available in all procedures via `ctx.user`

## Authorization

### Row-Level Security (RLS)

All tables have RLS enabled to enforce data isolation.

**Policy Pattern**:
```sql
CREATE POLICY "Users can view their own resources"
  ON table_name FOR SELECT
  USING (auth.uid() IN (
    SELECT auth_user_id FROM users WHERE id = created_by
  ));
```

**Visibility Levels**:
- **Private**: Only creator can access
- **Public**: All authenticated users can access
- **Organization**: Organization members can access (future)

### tRPC Authorization

All protected procedures check ownership:

```typescript
protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Verify user owns the resource
    const resource = await ctx.supabase
      .from('resources')
      .select('*')
      .eq('id', input.id)
      .eq('created_by', ctx.user.id)
      .single();
    
    if (!resource) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    
    // Proceed with mutation
  });
```

## Input Validation

### Zod Schemas

All tRPC inputs validated with Zod:

```typescript
.input(z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  age: z.number().int().positive(),
}))
```

**Benefits**:
- Type-safe validation
- Clear error messages
- Prevents injection attacks
- Validates data types

### SQL Injection Prevention

**Parameterized Queries**:
- Supabase client uses parameterized queries
- No raw SQL with user input
- All queries use Supabase query builder

**Example**:
```typescript
// Safe
await supabase
  .from('users')
  .select('*')
  .eq('id', userId); // Parameterized

// Never do this
await supabase.rpc('raw_sql', { query: `SELECT * FROM users WHERE id = '${userId}'` });
```

## Data Isolation

### Multi-Tenant Isolation

RLS policies ensure users can only access:
- Their own private resources
- Public resources (all users)
- Organization resources (future)

**Example Query**:
```typescript
// User can only see their own workflows + public ones
const { data: publicVisibility } = await ctx.supabase
  .from('component_visibility')
  .select('id')
  .eq('name', 'public')
  .single();

query = query.or(`created_by.eq.${ctx.user.id},visibility_id.eq.${publicVisibility.id}`);
```

## Security Best Practices

### 1. Never Trust Client Input

Always validate on the server:
- Zod schemas on all inputs
- Type checking
- Range validation
- Format validation

### 2. Use RLS for Data Access

Don't rely on application-level checks:
- RLS enforces at database level
- Works even if application code has bugs
- Prevents data leakage

### 3. Principle of Least Privilege

Users should only have access to what they need:
- Private resources: Only creator
- Public resources: All authenticated users
- Admin resources: Only admins (future)

### 4. Secure Token Storage

- httpOnly cookies (not accessible to JavaScript)
- Secure flag in production (HTTPS only)
- SameSite protection against CSRF

### 5. Input Sanitization

- Sanitize user input before storing
- Escape HTML in user-generated content
- Validate file uploads
- Check file types and sizes

## Security Headers

Next.js provides security headers:
- XSS protection
- Content Security Policy
- Frame options
- Referrer policy

## Environment Variables

**Never commit secrets**:
- Use `.env.local` (gitignored)
- Use environment variables in production
- Rotate keys regularly

**Required Secrets**:
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side only
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public (safe to expose)
- `DATABASE_URL` - Server-side only

## Audit Logging

**Future Enhancement**:
- Log all data access
- Track user actions
- Monitor for suspicious activity
- Compliance reporting

## Related Documentation

- [System Design](system-design.md) - Architecture overview
- [Database Schema](database-schema.md) - RLS policies
- [Development Guide](../development/README.md) - Security in development

