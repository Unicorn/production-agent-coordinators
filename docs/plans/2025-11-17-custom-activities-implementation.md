# Custom Activities Feature Implementation

## Date
2025-11-17

## Objective
Allow users to create custom activities with their own TypeScript code that can be executed in workflows.

## Requirements
1. Users can write custom TypeScript activity code
2. Code must be validated before saving
3. Custom activities appear in the workflow builder alongside built-in components
4. Custom activities execute properly when workflows run
5. Validation uses TypeScript compiler API for strict type checking

## Implementation

### 1. Database Schema (✅ Completed)

**Migration:** `20251117000006_add_custom_activity_code.sql`

Added columns to `components` table:
- `implementation_language` (VARCHAR) - Programming language (e.g., "typescript")
- `implementation_code` (TEXT) - User's custom TypeScript code
- `is_active` (BOOLEAN) - Whether component is active

### 2. TypeScript Validation (✅ Completed)

**File:** `src/lib/typescript-validator.ts`

Features:
- `validateTypeScriptCode()` - Uses TypeScript Compiler API for strict validation
- `validateActivityStructure()` - Ensures code exports async functions
- `extractExportedFunctions()` - Extracts function names for metadata
- Reports errors and warnings with line/column numbers

### 3. Code Editor Component (✅ Completed)

**File:** `src/components/code-editor/TypeScriptEditor.tsx`

Features:
- Textarea-based editor with monospace font
- Real-time TypeScript validation
- Display of errors and warnings
- Validation on blur and manual trigger
- Integration with tRPC validation endpoint

### 4. Component Form Updates (✅ Completed)

**File:** `src/components/component/ComponentForm.tsx`

Added:
- Toggle switch for "Custom Activity" mode (activities only)
- Conditional rendering of TypeScriptEditor
- Validation check before submission
- Passes `implementationCode` and `implementationLanguage` to API

### 5. API Updates (✅ Completed)

**File:** `src/server/api/routers/components.ts`

Added/Updated:
- `create` mutation: Validates custom code before saving
- `validateTypeScript` mutation: Real-time validation endpoint
- Validation checks:
  - TypeScript syntax and types
  - Activity structure (exports async function)
  - At least one exported function exists

### 6. Worker Manager Updates (✅ Completed)

**File:** `packages/workflow-worker-service/src/worker-manager.ts`

Added:
- `loadCustomActivities()` - Loads custom activities from database
- Extracts component IDs from workflow definitions
- Queries components with `implementation_code`
- Writes custom code to `custom-activities.ts`
- Merges custom activities with standard activities
- Dynamically imports and registers all activities

### 7. Documentation (✅ Completed)

**File:** `docs/user-guide/custom-activities.md`

Includes:
- How to create custom activities
- Code examples (simple, API calls, complex operations)
- Best practices (error handling, timeouts, logging, type safety)
- Input/output schema guidance
- Security considerations
- Troubleshooting guide

## Architecture

### Data Flow

```
User writes code → TypeScript validation → Save to DB → Worker loads code → Execute in workflow
```

### Validation Pipeline

1. **Client-side:** Real-time validation as user types/clicks validate
2. **API validation:** Server validates on create/update
3. **Worker validation:** Worker validates when loading (structural check)

### Code Execution

1. Worker queries workflows in project
2. Extracts component IDs from workflow nodes
3. Loads components with `implementation_code`
4. Writes code to temp file (`custom-activities.ts`)
5. Dynamically imports TypeScript code
6. Registers activities with Temporal
7. Activities available for workflow execution

## Security

### Input Validation
- TypeScript strict mode validation
- Structure validation (must export async function)
- No external package imports (sandbox)
- Code stored in database with user ownership

### Execution Isolation
- Activities run in Temporal worker process
- User must own component to create/edit
- RLS policies on components table
- Activity code only loaded for user's workflows

### Future Enhancements
- [ ] Add support for environment variables/secrets
- [ ] Implement resource limits (CPU, memory)
- [ ] Add code review/approval workflow for organization components
- [ ] Support external npm packages (with allowlist)
- [ ] Implement activity sandboxing (separate process/container)

## Testing

### Manual Testing Steps

1. **Create Custom Activity**
   - Navigate to Components → New Component
   - Select "Activity" type
   - Toggle "Custom Activity" on
   - Write TypeScript code (see examples)
   - Validate code
   - Save component

2. **Add to Workflow**
   - Create new workflow
   - Find custom activity in palette
   - Drag to canvas
   - Configure inputs
   - Connect to other steps
   - Save workflow

3. **Execute Workflow**
   - Build workflow
   - Verify worker loads custom activities
   - Run workflow
   - Check custom activity executes
   - Verify output is correct

### Test Cases

- ✅ Validation rejects invalid TypeScript
- ✅ Validation rejects non-async functions
- ✅ Validation rejects code without exports
- ✅ Valid code saves successfully
- ✅ Custom activities appear in palette
- ✅ Worker loads custom activities
- ✅ Custom activities execute in workflows
- ✅ Multiple custom activities work together
- ✅ Error handling works correctly
- ✅ Async operations complete properly

## Known Limitations

1. **No External Packages**: Users can't import npm packages yet
2. **No Sandboxing**: Activities run in same process as worker
3. **No Resource Limits**: No CPU/memory limits on custom code
4. **Basic Editor**: No syntax highlighting or autocomplete (future: Monaco)

## Future Improvements

### Editor Enhancements
- [ ] Monaco editor integration for better UX
- [ ] Syntax highlighting
- [ ] IntelliSense/autocomplete
- [ ] Inline error markers
- [ ] Code formatting (Prettier)
- [ ] Code snippets/templates

### Functionality
- [ ] Support more languages (Python, Go, etc.)
- [ ] Import npm packages (with security)
- [ ] Activity versioning
- [ ] Activity testing framework
- [ ] Activity templates library
- [ ] Share custom activities with team

### Security & Performance
- [ ] Activity sandboxing
- [ ] Resource limits enforcement
- [ ] Code review workflow
- [ ] Security scanning
- [ ] Performance monitoring
- [ ] Rate limiting

## Success Metrics

- Users can create custom activities
- Custom activities validate properly
- Custom activities execute in workflows
- No security vulnerabilities introduced
- Performance impact is minimal

## References

- TypeScript Compiler API: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- Temporal Activities: https://docs.temporal.io/activities
- Code validation patterns: [Internal docs]

