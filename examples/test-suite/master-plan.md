# Test Suite Master Plan

This is a minimal test suite for demonstrating the Suite Builder workflow with Temporal integration.

## Suite Overview

- **Suite Name**: test-suite
- **Total Packages**: 3
- **Purpose**: Demonstrate dependency graph construction and multi-phase workflow execution

## Package Definitions

The parser expects format: `- Package: @scope/name (category) [dep1, dep2]`

- Package: @test-suite/package-a (core)
- Package: @test-suite/package-b (service) [@test-suite/package-a]
- Package: @test-suite/package-c (ui) [@test-suite/package-b]

### Details

**package-a**: Foundation package with no dependencies
- Core utilities
- Basic types
- Helper functions
- Build Priority: Layer 0 (builds first)

**package-b**: Intermediate package that depends on package-a
- Business logic
- Data models
- Services using package-a utilities
- Build Priority: Layer 1 (builds after package-a)

**package-c**: Top-level package that depends on package-b
- Application layer
- API endpoints
- UI components using package-b services
- Build Priority: Layer 2 (builds after package-b)

## Dependency Graph

```
package-a (Layer 0)
    ↓
package-b (Layer 1)
    ↓
package-c (Layer 2)
```

## Expected Build Order

1. package-a (no dependencies)
2. package-b (depends on package-a)
3. package-c (depends on package-b)

## Success Criteria

The suite builder workflow should:

1. **INITIALIZE Phase**:
   - Load all 3 packages from this master plan
   - Build dependency graph with 3 layers
   - Generate correct build order: [package-a, package-b, package-c]
   - Detect no circular dependencies
   - Identify no missing plans

2. **PLAN Phase**:
   - Verify all packages have plans (pre-existing)
   - No missing plans to generate

3. **BUILD Phase**:
   - Build packages in correct order
   - Respect dependency constraints
   - Handle sequential builds (maxConcurrentBuilds: 1)

4. **VERIFY Phase**:
   - Verify all builds succeeded
   - Check package integrity
   - Validate dependencies are satisfied

5. **COMPLETE Phase**:
   - Store build artifacts
   - Generate build report
   - Mark suite as complete

## Notes

This test suite uses a simple linear dependency chain to demonstrate the core workflow mechanics. Future test suites can include:

- Diamond dependencies (A → B,C; B,C → D)
- Multiple independent chains
- Deeper dependency trees
- Larger package counts (10-88+ packages)
