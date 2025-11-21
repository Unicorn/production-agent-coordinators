/**
 * Quality Standards Template
 *
 * Defines comprehensive code quality requirements for AI-generated packages.
 * These standards are injected into prompts to ensure consistent, production-ready code.
 */

export const QUALITY_STANDARDS = `
## Code Quality Standards

Your implementation MUST meet ALL of the following quality standards:

### TypeScript Requirements
1. **Strict Mode Enabled**
   - \`tsconfig.json\` must have \`"strict": true\`
   - All type checks enabled (noImplicitAny, strictNullChecks, etc.)

2. **No \`any\` Types**
   - Never use \`any\` type - use proper types or \`unknown\` with type guards
   - Exception: Only when interfacing with untyped third-party libraries

3. **Complete Type Coverage**
   - All function parameters and return types explicitly typed
   - All exported interfaces and types documented
   - Generic types properly constrained

4. **Type Safety**
   - No type assertions unless absolutely necessary
   - If using type assertions, add comment explaining why
   - Prefer type narrowing with type guards

### Testing Requirements
1. **Minimum 80% Code Coverage**
   - Line coverage ≥ 80%
   - Branch coverage ≥ 75%
   - Function coverage ≥ 80%

2. **Comprehensive Test Suite**
   - Unit tests for all exported functions
   - Edge cases and error conditions tested
   - Integration tests for public APIs

3. **Vitest Framework**
   - Use \`vitest\` for all tests
   - Place tests in \`tests/\` directory
   - Test file naming: \`*.test.ts\`

4. **Test Quality**
   - Descriptive test names explaining what is being tested
   - Arrange-Act-Assert pattern
   - No test interdependencies (tests must be independent)
   - Mock external dependencies properly

### Code Organization
1. **Module Structure**
   - Clear separation of concerns
   - Single Responsibility Principle
   - Minimal coupling between modules

2. **File Organization**
   - \`src/\` - Source code
   - \`tests/\` - Test files
   - \`types/\` or inline types for TypeScript definitions
   - Maximum 300 lines per file (split if larger)

3. **Naming Conventions**
   - camelCase for variables and functions
   - PascalCase for types, interfaces, and classes
   - SCREAMING_SNAKE_CASE for constants
   - Descriptive names (no single letters except loop indices)

4. **Exports**
   - Named exports preferred over default exports
   - All public APIs exported from index.ts
   - Internal utilities not exported

### Error Handling
1. **Comprehensive Error Handling**
   - All error cases identified and handled
   - Custom error types for domain-specific errors
   - Never use empty catch blocks

2. **Error Messages**
   - Clear, actionable error messages
   - Include context and suggestions for resolution
   - No error codes without explanations

3. **Validation**
   - Input validation for all public functions
   - Throw errors for invalid input (fail fast)
   - Document validation rules in JSDoc

### Documentation
1. **JSDoc Comments**
   - All exported functions have JSDoc with:
     - Description of what the function does
     - @param tags for each parameter
     - @returns tag describing return value
     - @throws tag for any errors thrown
     - @example tag with usage example (for complex functions)

2. **README.md**
   - Clear description of what the package does
   - Installation instructions
   - Usage examples
   - API documentation (or link to generated docs)

3. **Inline Comments**
   - Complex logic explained with comments
   - "Why" not "what" - explain intent, not mechanics
   - No commented-out code in final version

### Package Configuration
1. **package.json**
   - Semantic versioning (start at 1.0.0)
   - \`"type": "module"\` for ES modules
   - Proper \`exports\` field configuration
   - All dependencies with specific versions (no ranges for internal packages)
   - Scripts for: build, test, lint, clean

2. **ES Modules**
   - Use \`import\`/\`export\` (not \`require\`)
   - All imports must include \`.js\` extension
   - No mixed module systems

3. **Dependencies**
   - Minimal dependencies (only what's necessary)
   - No deprecated packages
   - Security vulnerabilities checked

### Code Style
1. **Consistency**
   - Consistent code style throughout
   - Follow existing codebase patterns
   - Use Prettier/ESLint configuration if present

2. **Readability**
   - Clear, self-documenting code
   - Short functions (prefer <50 lines)
   - Avoid deep nesting (max 3 levels)

3. **Best Practices**
   - Immutability preferred (const over let)
   - Pure functions when possible
   - Avoid side effects in utility functions
   - No magic numbers (use named constants)

### Quality Checklist

After implementing, verify ALL items are true:

- [ ] \`tsconfig.json\` has \`"strict": true\`
- [ ] No \`any\` types in the code
- [ ] All exported functions have JSDoc comments
- [ ] Test coverage ≥ 80%
- [ ] All tests pass
- [ ] Error handling complete (no empty catch blocks)
- [ ] README.md with usage examples
- [ ] \`package.json\` properly configured with ES modules
- [ ] All imports use \`.js\` extensions
- [ ] No magic numbers or single-letter variables
- [ ] Code follows naming conventions
- [ ] No console.log statements (use proper logging)
- [ ] No TODOs or FIXMEs in committed code
- [ ] All dependencies necessary and up-to-date

**If ANY checklist item is false, the implementation is NOT complete.**
`;

/**
 * Get quality standards template with optional customizations
 */
export function getQualityStandards(options?: {
  minCoverage?: number;
  maxFileLines?: number;
  includeChecklist?: boolean;
}): string {
  let standards = QUALITY_STANDARDS;

  // Customize coverage requirement
  if (options?.minCoverage !== undefined) {
    standards = standards.replace(/≥ 80%/g, `≥ ${options.minCoverage}%`);
  }

  // Customize max file lines
  if (options?.maxFileLines !== undefined) {
    standards = standards.replace(/300 lines/, `${options.maxFileLines} lines`);
  }

  // Optionally remove checklist
  if (options?.includeChecklist === false) {
    const checklistIndex = standards.indexOf('### Quality Checklist');
    if (checklistIndex !== -1) {
      standards = standards.substring(0, checklistIndex).trim();
    }
  }

  return standards;
}
