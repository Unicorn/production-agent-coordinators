# Fix Compliance Command

The compliance check failed with these errors:

```
$ARGUMENTS
```

## Your Task

Fix these issues following these principles:

1. **Identify root causes** (not just symptoms)
   - Analyze the error messages carefully
   - Determine if this is a surface issue or deeper problem
   - Check if multiple errors stem from a single root cause

2. **Make minimal, surgical changes**
   - Fix only what's broken
   - Do not regenerate entire files unless absolutely necessary
   - Preserve working code

3. **Do not regenerate entire files**
   - Edit existing files in place
   - Make targeted fixes
   - Only rewrite if the file structure is fundamentally wrong

4. **Verify fixes address all reported errors**
   - Ensure each error in the log is addressed
   - Check for related issues that might not be explicitly mentioned
   - Verify fixes don't introduce new errors

## Error Categories

### TypeScript Errors (TSC_ERROR)
- Fix type annotations
- Resolve interface mismatches
- Add missing type definitions
- Fix import/export type issues

### ESLint Errors (ESLINT_ERROR)
- Fix code style violations
- Add missing return types
- Remove unused variables
- Fix import ordering

### Test Failures (JEST_FAILURE)
- Fix failing test assertions
- Update mocks if needed
- Fix test setup/teardown
- Ensure test data is correct

### Build Errors (NPM_INSTALL)
- Fix dependency issues
- Update package.json if needed
- Resolve version conflicts

## Approach

1. Read the error log carefully
2. Identify the specific files and lines mentioned
3. Make targeted fixes to those locations
4. Verify the fix addresses the root cause
5. Check for similar issues in other files

Remember: You created these files, so you understand the intent. Use that knowledge to make informed fixes rather than guessing.

