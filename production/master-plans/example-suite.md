# Example Suite - Master Plan

This is an EXAMPLE master plan. Copy and customize for your real suites.

**NOTE:** Real master plans in this directory are gitignored to protect proprietary information.

## Package Dependency Graph

### Layer 0: Core Utilities (No Dependencies)
- Package: @yourorg/core-logger (core) []
- Package: @yourorg/core-config (core) []

### Layer 1: Shared Libraries (Depends on Core)
- Package: @yourorg/shared-utils (shared) [@yourorg/core-logger, @yourorg/core-config]

### Layer 2: Feature Packages (Depends on Shared)
- Package: @yourorg/feature-a (feature) [@yourorg/shared-utils]
- Package: @yourorg/feature-b (feature) [@yourorg/shared-utils]

### Layer 3: Suite Package (Depends on Everything)
- Package: @yourorg/example-suite (suite) [@yourorg/feature-a, @yourorg/feature-b]

## Build Order

1. Layer 0: core-logger, core-config (parallel)
2. Layer 1: shared-utils
3. Layer 2: feature-a, feature-b (parallel)
4. Layer 3: example-suite

Total: 6 packages across 4 layers
