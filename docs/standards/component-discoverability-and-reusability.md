# Component Discoverability and Reusability Standards

**Version:** 1.0.0
**Date:** 2025-11-13
**Status:** Standard
**Related:** [Temporal Workflow Standardization and Service Architecture](../plans/2025-11-13-temporal-workflow-standardization-and-service-architecture.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Component Metadata Standards](#component-metadata-standards)
3. [Registry Patterns](#registry-patterns)
4. [Discovery Mechanisms](#discovery-mechanisms)
5. [Version Management](#version-management)
6. [Reusability Patterns](#reusability-patterns)
7. [Code Examples](#code-examples)
8. [Tooling](#tooling)

---

## Overview

### Purpose

This document establishes standards for making Temporal workflows, activities, and agent prompts **discoverable**, **versioned**, and **reusable** across the entire production agent coordinator ecosystem. These standards enable:

- **Dynamic component discovery**: Workflows can find available activities and agents at runtime
- **Type-safe integration**: TypeScript interfaces ensure compile-time validation
- **Version management**: Semver-based versioning with deprecation paths
- **Operational visibility**: Rich metadata appears in Temporal UI for debugging
- **Self-improving systems**: Workflows can request new agents from the Agent Prompt Writer service

### Core Principles

1. **Single Source of Truth**: Each component has one canonical metadata export
2. **MECE Compliance**: Mutually Exclusive, Collectively Exhaustive registry organization
3. **Semantic Versioning**: All components use semver (MAJOR.MINOR.PATCH)
4. **Explicit Contracts**: Signal payloads and activity inputs are strongly typed
5. **Runtime Discovery**: Components can be queried programmatically by capability, type, or version

---

## Component Metadata Standards

### 1. Workflow Metadata

All workflows MUST export a metadata object describing their identity, contracts, and dependencies.

#### Schema

```typescript
/**
 * Workflow metadata for discoverability and operational visibility
 */
interface WorkflowMetadata {
  /** Workflow function name in PascalCase (e.g., PlanWriterServiceWorkflow) */
  name: string;

  /** Workflow ID pattern used in Temporal (e.g., plan-writer-service) */
  workflowId: string;

  /** Human-readable description of what this workflow does */
  description: string;

  /** Service classification */
  serviceType: 'long-running' | 'short-running';

  /** What external events trigger this workflow (schedules, signals, manual) */
  triggers: string[];

  /** Which downstream services this workflow signals */
  signalsTo: string[];

  /** Which upstream services can signal this workflow */
  signalsFrom: string[];

  /** Which MCP operations this workflow performs */
  mcpOperations: string[];

  /** Which git operations this workflow performs */
  gitOperations: string[];

  /** Semantic version of this workflow */
  version: string;

  /** Optional: Tags for categorization and search */
  tags?: string[];

  /** Optional: Deprecated flag with migration guidance */
  deprecated?: {
    reason: string;
    migrateToWorkflow: string;
    migrateToVersion: string;
    deprecatedSince: string; // ISO 8601 date
  };
}
```

#### Example: Plan Writer Service

```typescript
// File: packages/agents/plan-writer-production/src/workflows/metadata.ts

export const PlanWriterServiceMetadata: WorkflowMetadata = {
  name: 'PlanWriterServiceWorkflow',
  workflowId: 'plan-writer-service',
  description: 'Long-running service that writes package plans and files them to MCP',
  serviceType: 'long-running',
  triggers: [
    'discovery-service',
    'monitor-service',
    'integration-service',
    'ideation-service'
  ],
  signalsTo: ['mcp-api'],
  signalsFrom: [
    'discovery-service',
    'monitor-service',
    'integration-service',
    'ideation-service'
  ],
  mcpOperations: [
    'packages_update (plan_file_path, plan_git_branch, status)'
  ],
  gitOperations: [
    'commit --no-verify',
    'push origin feature/{package-name}'
  ],
  version: '1.0.0',
  tags: ['planning', 'git', 'mcp']
};
```

#### Example: Package Builder Service

```typescript
// File: packages/agents/package-builder-production/src/workflows/metadata.ts

export const PackageBuilderServiceMetadata: WorkflowMetadata = {
  name: 'PackageBuilderServiceWorkflow',
  workflowId: 'package-builder-service',
  description: 'Long-running service that builds packages, runs tests, spawns fix agents, and signals downstream services',
  serviceType: 'long-running',
  triggers: ['mcp-query (status=plan_ready)', 'qa-service (rework signal)'],
  signalsTo: ['docs-service', 'qa-service'],
  signalsFrom: ['qa-service'],
  mcpOperations: [
    'packages_query (status=plan_ready)',
    'packages_get (plan_content)',
    'packages_update (status=building/built)'
  ],
  gitOperations: [
    'clone',
    'checkout feature/{package-name}',
    'commit --no-verify',
    'push origin feature/{package-name}'
  ],
  version: '2.0.0',
  tags: ['building', 'testing', 'agents', 'git']
};
```

---

### 2. Activity Metadata

All activities MUST export metadata describing their purpose, type, and execution characteristics.

#### Schema

```typescript
/**
 * Activity metadata for discoverability and Temporal UI display
 */
interface ActivityMetadata {
  /** Activity function name in camelCase (e.g., runBuild, spawnFixAgent) */
  name: string;

  /** Human-readable display name for Temporal UI */
  displayName: string;

  /** Description of what this activity does */
  description: string;

  /** Activity classification */
  activityType: 'standard' | 'cli' | 'agentic';

  /** Semantic version of this activity */
  version: string;

  /** Optional: Tags for categorization */
  tags?: string[];

  /** Optional: Expected execution time range (for timeout planning) */
  expectedDurationMs?: {
    min: number;
    avg: number;
    max: number;
  };

  /** Agentic activities only: Model provider (e.g., anthropic, openai) */
  modelProvider?: string;

  /** Agentic activities only: Model name (e.g., claude-sonnet-4-5-20250929) */
  modelName?: string;

  /** Agentic activities only: Reference to agent prompt registry */
  agentPromptId?: string;

  /** Agentic activities only: Semver version of agent prompt */
  agentPromptVersion?: string;

  /** Optional: Capabilities this agent provides (for discovery) */
  capabilities?: string[];

  /** Optional: Deprecated flag with migration guidance */
  deprecated?: {
    reason: string;
    migrateToActivity: string;
    migrateToVersion: string;
    deprecatedSince: string; // ISO 8601 date
  };
}
```

#### Example: Standard Activity (CLI)

```typescript
// File: packages/agents/package-builder-production/src/activities/build.activities.ts

export const runBuildMetadata: ActivityMetadata = {
  name: 'runBuild',
  displayName: 'Run package build (yarn build)',
  description: 'Executes yarn build in package directory and captures output',
  activityType: 'cli',
  version: '1.0.0',
  tags: ['build', 'cli', 'yarn'],
  expectedDurationMs: {
    min: 5000,
    avg: 15000,
    max: 60000
  }
};

export async function runBuild(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<BuildResult> {
  // Implementation...
}
```

#### Example: Agentic Activity

```typescript
// File: packages/agents/package-builder-production/src/activities/agent.activities.ts

export const spawnFixAgentMetadata: ActivityMetadata = {
  name: 'spawnFixAgent',
  displayName: 'Fix test failures (claude-sonnet-4-5 | fix-agent-v1.2.0)',
  description: 'Spawns AI agent to analyze and fix failing tests, linting errors, and build issues',
  activityType: 'agentic',
  version: '1.2.0',
  modelProvider: 'anthropic',
  modelName: 'claude-sonnet-4-5-20250929',
  agentPromptId: 'fix-agent',
  agentPromptVersion: '1.2.0',
  capabilities: [
    'fix-failing-tests',
    'fix-linting-errors',
    'fix-build-errors',
    'analyze-test-coverage'
  ],
  tags: ['agent', 'fix', 'testing', 'quality'],
  expectedDurationMs: {
    min: 30000,
    avg: 120000,
    max: 600000
  }
};

export async function spawnFixAgent(input: {
  packagePath: string;
  planPath: string;
  failures: QualityFailure[];
}): Promise<void> {
  // Implementation...
}
```

#### Display Name Format for Agentic Activities

Agentic activity display names MUST follow this format for Temporal UI clarity:

```
{Human Description} ({model-name} | {agent-prompt-id}-v{version})
```

**Examples:**
- `Fix test failures (claude-sonnet-4-5 | fix-agent-v1.2.0)`
- `Write package documentation (gpt-4 | docs-agent-v2.0.0)`
- `Generate creative enhancements (claude-opus-4 | whimsy-agent-v1.0.0)`

---

### 3. Agent Prompt Metadata

Agent prompts stored in the registry MUST include metadata for versioning and capability discovery.

#### Schema

```typescript
/**
 * Agent prompt registry metadata
 */
interface AgentPromptMetadata {
  /** Unique agent prompt identifier (kebab-case) */
  agentPromptId: string;

  /** Human-readable name */
  displayName: string;

  /** Description of agent's purpose and capabilities */
  description: string;

  /** Latest stable version */
  latestVersion: string;

  /** All available versions (sorted newest first) */
  versions: AgentPromptVersion[];

  /** Capabilities this agent provides */
  capabilities: string[];

  /** Recommended model providers for this agent */
  recommendedProviders: {
    provider: string;
    model: string;
    reason: string;
  }[];

  /** Tags for categorization */
  tags: string[];
}

interface AgentPromptVersion {
  /** Semantic version */
  version: string;

  /** Absolute path to prompt file */
  filePath: string;

  /** ISO 8601 timestamp */
  createdAt: string;

  /** Capabilities in this version */
  capabilities: string[];

  /** Optional: Changelog/release notes */
  changelog?: string;

  /** Optional: Deprecated flag */
  deprecated?: {
    reason: string;
    migrateToVersion: string;
    deprecatedSince: string;
  };
}
```

#### Example: Fix Agent Metadata

```typescript
// File: agents/registry/fix-agent/metadata.json
{
  "agentPromptId": "fix-agent",
  "displayName": "Fix Agent",
  "description": "Analyzes and fixes failing tests, linting errors, and build issues",
  "latestVersion": "1.2.0",
  "versions": [
    {
      "version": "1.2.0",
      "filePath": "agents/registry/fix-agent/v1.2.0.md",
      "createdAt": "2025-11-13T00:00:00Z",
      "capabilities": [
        "fix-failing-tests",
        "fix-linting-errors",
        "fix-build-errors",
        "analyze-test-coverage",
        "suggest-test-improvements"
      ],
      "changelog": "Added test improvement suggestions and coverage analysis"
    },
    {
      "version": "1.1.0",
      "filePath": "agents/registry/fix-agent/v1.1.0.md",
      "createdAt": "2025-11-01T00:00:00Z",
      "capabilities": [
        "fix-failing-tests",
        "fix-linting-errors",
        "fix-build-errors"
      ]
    },
    {
      "version": "1.0.0",
      "filePath": "agents/registry/fix-agent/v1.0.0.md",
      "createdAt": "2025-10-15T00:00:00Z",
      "capabilities": [
        "fix-failing-tests",
        "analyze-errors"
      ],
      "deprecated": {
        "reason": "Missing linting and build error support",
        "migrateToVersion": "1.2.0",
        "deprecatedSince": "2025-11-01"
      }
    }
  ],
  "capabilities": [
    "fix-failing-tests",
    "fix-linting-errors",
    "fix-build-errors",
    "analyze-test-coverage",
    "suggest-test-improvements"
  ],
  "recommendedProviders": [
    {
      "provider": "anthropic",
      "model": "claude-sonnet-4-5-20250929",
      "reason": "Best balance of speed and accuracy for code fixes"
    },
    {
      "provider": "openai",
      "model": "gpt-4-turbo",
      "reason": "Alternative with good code understanding"
    }
  ],
  "tags": ["fix", "testing", "quality", "linting", "build"]
}
```

---

## Registry Patterns

### 1. Activity Registry

A centralized registry allows workflows to discover activities by capability, type, or tags.

#### Registry Structure

```typescript
// File: packages/shared/temporal-registry/src/activity-registry.ts

export class ActivityRegistry {
  private static activities = new Map<string, ActivityMetadata>();

  /**
   * Register an activity in the global registry
   */
  static register(metadata: ActivityMetadata): void {
    if (this.activities.has(metadata.name)) {
      throw new Error(`Activity ${metadata.name} already registered`);
    }
    this.activities.set(metadata.name, metadata);
  }

  /**
   * Find activity by exact name
   */
  static get(name: string): ActivityMetadata | undefined {
    return this.activities.get(name);
  }

  /**
   * Find activities by capability
   */
  static findByCapability(capability: string): ActivityMetadata[] {
    return Array.from(this.activities.values())
      .filter(a => a.capabilities?.includes(capability));
  }

  /**
   * Find activities by type
   */
  static findByType(type: ActivityMetadata['activityType']): ActivityMetadata[] {
    return Array.from(this.activities.values())
      .filter(a => a.activityType === type);
  }

  /**
   * Find activities by tag
   */
  static findByTag(tag: string): ActivityMetadata[] {
    return Array.from(this.activities.values())
      .filter(a => a.tags?.includes(tag));
  }

  /**
   * List all registered activities
   */
  static list(): ActivityMetadata[] {
    return Array.from(this.activities.values());
  }

  /**
   * Check if activity is deprecated
   */
  static isDeprecated(name: string): boolean {
    const metadata = this.get(name);
    return !!metadata?.deprecated;
  }
}
```

#### Auto-Registration Pattern

Activities auto-register themselves when imported:

```typescript
// File: packages/agents/package-builder-production/src/activities/build.activities.ts

import { ActivityRegistry } from '@bernierllc/temporal-registry';

// Metadata definition
export const runBuildMetadata: ActivityMetadata = {
  name: 'runBuild',
  displayName: 'Run package build (yarn build)',
  // ... rest of metadata
};

// Auto-register on module load
ActivityRegistry.register(runBuildMetadata);

// Activity implementation
export async function runBuild(input: BuildInput): Promise<BuildResult> {
  // Implementation...
}
```

---

### 2. Workflow Registry

Similar pattern for workflows:

```typescript
// File: packages/shared/temporal-registry/src/workflow-registry.ts

export class WorkflowRegistry {
  private static workflows = new Map<string, WorkflowMetadata>();

  static register(metadata: WorkflowMetadata): void {
    if (this.workflows.has(metadata.workflowId)) {
      throw new Error(`Workflow ${metadata.workflowId} already registered`);
    }
    this.workflows.set(metadata.workflowId, metadata);
  }

  static get(workflowId: string): WorkflowMetadata | undefined {
    return this.workflows.get(workflowId);
  }

  static findByServiceType(
    type: WorkflowMetadata['serviceType']
  ): WorkflowMetadata[] {
    return Array.from(this.workflows.values())
      .filter(w => w.serviceType === type);
  }

  static findByTag(tag: string): WorkflowMetadata[] {
    return Array.from(this.workflows.values())
      .filter(w => w.tags?.includes(tag));
  }

  static list(): WorkflowMetadata[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get workflow dependency graph (what signals what)
   */
  static getDependencyGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const workflow of this.workflows.values()) {
      graph.set(workflow.workflowId, workflow.signalsTo);
    }

    return graph;
  }
}
```

---

### 3. Agent Prompt Registry

File-based registry with JSON index for fast lookups:

#### Directory Structure

```
agents/
  registry/
    fix-agent/
      v1.0.0.md
      v1.1.0.md
      v1.2.0.md
      metadata.json
    test-writer-agent/
      v1.0.0.md
      v1.1.0.md
      metadata.json
    docs-agent/
      v1.0.0.md
      metadata.json
    whimsy-agent/
      v1.0.0.md
      metadata.json
  registry-index.json
```

#### Registry Index

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-11-13T00:00:00Z",
  "agents": {
    "fix-agent": {
      "metadataPath": "agents/registry/fix-agent/metadata.json",
      "latestVersion": "1.2.0"
    },
    "test-writer-agent": {
      "metadataPath": "agents/registry/test-writer-agent/metadata.json",
      "latestVersion": "1.1.0"
    },
    "docs-agent": {
      "metadataPath": "agents/registry/docs-agent/metadata.json",
      "latestVersion": "1.0.0"
    },
    "whimsy-agent": {
      "metadataPath": "agents/registry/whimsy-agent/metadata.json",
      "latestVersion": "1.0.0"
    }
  }
}
```

#### Agent Prompt Registry API

```typescript
// File: packages/shared/agent-registry/src/index.ts

export class AgentPromptRegistry {
  private static indexPath = 'agents/registry-index.json';
  private static cache = new Map<string, AgentPromptMetadata>();

  /**
   * Load registry index from filesystem
   */
  static async loadIndex(): Promise<void> {
    const indexContent = await fs.readFile(this.indexPath, 'utf-8');
    const index = JSON.parse(indexContent);

    // Load all agent metadata
    for (const [agentId, entry] of Object.entries(index.agents)) {
      const metadataContent = await fs.readFile(entry.metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent) as AgentPromptMetadata;
      this.cache.set(agentId, metadata);
    }
  }

  /**
   * Get agent metadata by ID
   */
  static get(agentPromptId: string): AgentPromptMetadata | undefined {
    return this.cache.get(agentPromptId);
  }

  /**
   * Get specific version of agent prompt
   */
  static async getPrompt(
    agentPromptId: string,
    version: string
  ): Promise<string> {
    const metadata = this.get(agentPromptId);
    if (!metadata) {
      throw new Error(`Agent ${agentPromptId} not found in registry`);
    }

    const versionInfo = metadata.versions.find(v => v.version === version);
    if (!versionInfo) {
      throw new Error(
        `Version ${version} not found for agent ${agentPromptId}`
      );
    }

    return fs.readFile(versionInfo.filePath, 'utf-8');
  }

  /**
   * Get latest version of agent prompt
   */
  static async getLatestPrompt(agentPromptId: string): Promise<string> {
    const metadata = this.get(agentPromptId);
    if (!metadata) {
      throw new Error(`Agent ${agentPromptId} not found in registry`);
    }

    return this.getPrompt(agentPromptId, metadata.latestVersion);
  }

  /**
   * Find agents by capability
   */
  static findByCapability(capability: string): AgentPromptMetadata[] {
    return Array.from(this.cache.values())
      .filter(a => a.capabilities.includes(capability));
  }

  /**
   * Register new agent prompt version
   */
  static async registerVersion(
    agentPromptId: string,
    version: string,
    promptContent: string,
    capabilities: string[],
    changelog?: string
  ): Promise<void> {
    const metadata = this.get(agentPromptId);
    if (!metadata) {
      throw new Error(`Agent ${agentPromptId} not found in registry`);
    }

    // Write prompt file
    const promptPath = `agents/registry/${agentPromptId}/v${version}.md`;
    await fs.writeFile(promptPath, promptContent);

    // Update metadata
    const versionInfo: AgentPromptVersion = {
      version,
      filePath: promptPath,
      createdAt: new Date().toISOString(),
      capabilities,
      changelog
    };

    metadata.versions.unshift(versionInfo);
    metadata.latestVersion = version;
    metadata.capabilities = capabilities;

    // Write updated metadata
    const metadataPath = `agents/registry/${agentPromptId}/metadata.json`;
    await fs.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2)
    );

    // Update cache
    this.cache.set(agentPromptId, metadata);

    // Update registry index
    await this.updateIndex();
  }

  private static async updateIndex(): Promise<void> {
    const index = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      agents: {} as Record<string, any>
    };

    for (const [agentId, metadata] of this.cache.entries()) {
      index.agents[agentId] = {
        metadataPath: `agents/registry/${agentId}/metadata.json`,
        latestVersion: metadata.latestVersion
      };
    }

    await fs.writeFile(
      this.indexPath,
      JSON.stringify(index, null, 2)
    );
  }
}
```

---

## Discovery Mechanisms

### 1. Static Discovery (Compile-Time)

Activities and workflows are discovered through TypeScript imports and auto-registration:

```typescript
// File: packages/agents/package-builder-production/src/worker.ts

import { Worker } from '@temporalio/worker';
import { ActivityRegistry, WorkflowRegistry } from '@bernierllc/temporal-registry';

// Import activities (auto-registers them)
import * as buildActivities from './activities/build.activities';
import * as agentActivities from './activities/agent.activities';
import * as reportActivities from './activities/report.activities';

// Import workflow metadata (auto-registers it)
import { PackageBuilderServiceMetadata } from './workflows/metadata';

async function main() {
  // List all registered activities for logging
  const activities = ActivityRegistry.list();
  console.log('Registered activities:', activities.map(a => a.name));

  // Create worker with all registered activities
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities: {
      ...buildActivities,
      ...agentActivities,
      ...reportActivities
    },
    taskQueue: 'package-builder'
  });

  await worker.run();
}
```

---

### 2. Dynamic Discovery (Runtime)

Workflows can query registries at runtime to find capabilities:

#### Example: Dynamic Agent Selection

```typescript
// File: packages/agents/package-builder-production/src/workflows/package-builder.workflow.ts

import { proxyActivities } from '@temporalio/workflow';
import { ActivityRegistry } from '@bernierllc/temporal-registry';

export async function PackageBuilderServiceWorkflow(
  input: BuildInput
): Promise<void> {
  // Query registry for activities that can fix linting errors
  const fixActivities = ActivityRegistry.findByCapability('fix-linting-errors');

  if (fixActivities.length === 0) {
    throw new Error('No activities found for capability: fix-linting-errors');
  }

  // Select latest version
  const latestFixActivity = fixActivities
    .sort((a, b) => semver.compare(b.version, a.version))[0];

  console.log(`Using fix activity: ${latestFixActivity.name} v${latestFixActivity.version}`);

  // Create activity proxy
  const activities = proxyActivities({
    startToCloseTimeout: '10 minutes'
  });

  // Call dynamically discovered activity
  await activities[latestFixActivity.name]({
    packagePath: input.packagePath,
    planPath: input.planPath,
    failures: input.failures
  });
}
```

---

### 3. MCP-Based Discovery

The MCP packages-api serves as external state for package lifecycle discovery:

```typescript
// File: packages/agents/package-builder-production/src/workflows/package-builder.workflow.ts

import { proxyActivities } from '@temporalio/workflow';

export async function PackageBuilderServiceWorkflow(): Promise<void> {
  const activities = proxyActivities({
    startToCloseTimeout: '5 minutes'
  });

  while (true) {
    // Query MCP for packages ready to build
    const packages = await activities.queryMCP({
      operation: 'packages_query',
      filters: {
        status: ['plan_ready']
      },
      sort: '-priority',
      limit: 10
    });

    if (packages.length === 0) {
      // Wait for signal or schedule
      await sleep('5 minutes');
      continue;
    }

    // Process each package
    for (const pkg of packages) {
      await activities.updateMCPStatus({
        packageId: pkg.id,
        status: 'building'
      });

      // Build, test, fix...
      await buildPackage(pkg);
    }
  }
}
```

---

## Version Management

### 1. Semantic Versioning

All components use [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR**: Breaking changes (incompatible API changes)
- **MINOR**: New features (backward-compatible)
- **PATCH**: Bug fixes (backward-compatible)

#### Examples

**Activity Version Changes:**

```typescript
// v1.0.0: Initial release
export async function runBuild(input: { packagePath: string }): Promise<BuildResult>

// v1.1.0: MINOR - Added optional config (backward-compatible)
export async function runBuild(input: {
  packagePath: string;
  config?: BuildConfig;
}): Promise<BuildResult>

// v2.0.0: MAJOR - Changed return type (breaking)
export async function runBuild(input: {
  packagePath: string;
  config?: BuildConfig;
}): Promise<DetailedBuildResult> // Changed return type
```

---

### 2. Deprecation Strategy

When deprecating a component, follow this process:

1. **Mark as deprecated** in metadata
2. **Add migration guidance**
3. **Log warnings** when deprecated component is used
4. **Maintain for 2 major versions** before removal

#### Example: Deprecating an Activity

```typescript
// File: packages/agents/package-builder-production/src/activities/build.activities.ts

export const runBuildMetadata: ActivityMetadata = {
  name: 'runBuild',
  displayName: 'Run package build (yarn build)',
  description: 'Executes yarn build in package directory',
  activityType: 'cli',
  version: '1.5.0',
  deprecated: {
    reason: 'Replaced by runBuildV2 which supports incremental builds',
    migrateToActivity: 'runBuildV2',
    migrateToVersion: '2.0.0',
    deprecatedSince: '2025-11-01'
  }
};

export async function runBuild(input: BuildInput): Promise<BuildResult> {
  // Log deprecation warning
  console.warn(
    `DEPRECATION WARNING: runBuild is deprecated since 2025-11-01. ` +
    `Migrate to runBuildV2 v2.0.0: Replaced by runBuildV2 which supports incremental builds`
  );

  // Continue execution for backward compatibility
  // Implementation...
}
```

---

### 3. Version Resolution

When multiple versions exist, use this resolution strategy:

```typescript
// File: packages/shared/temporal-registry/src/version-resolver.ts

export class VersionResolver {
  /**
   * Select activity version based on constraints
   */
  static resolveActivity(
    capability: string,
    versionConstraint?: string // e.g., "^1.0.0", ">=2.0.0"
  ): ActivityMetadata {
    const candidates = ActivityRegistry.findByCapability(capability);

    // Filter out deprecated activities
    const active = candidates.filter(a => !a.deprecated);

    if (versionConstraint) {
      // Use semver matching
      const matching = active.filter(a =>
        semver.satisfies(a.version, versionConstraint)
      );

      if (matching.length === 0) {
        throw new Error(
          `No activities found for capability "${capability}" ` +
          `matching version constraint "${versionConstraint}"`
        );
      }

      // Return latest matching version
      return matching.sort((a, b) =>
        semver.compare(b.version, a.version)
      )[0];
    }

    // Return latest version
    return active.sort((a, b) =>
      semver.compare(b.version, a.version)
    )[0];
  }

  /**
   * Select agent prompt version
   */
  static async resolveAgentPrompt(
    agentPromptId: string,
    versionConstraint?: string
  ): Promise<AgentPromptVersion> {
    const metadata = AgentPromptRegistry.get(agentPromptId);
    if (!metadata) {
      throw new Error(`Agent prompt ${agentPromptId} not found`);
    }

    // Filter out deprecated versions
    const active = metadata.versions.filter(v => !v.deprecated);

    if (versionConstraint) {
      const matching = active.filter(v =>
        semver.satisfies(v.version, versionConstraint)
      );

      if (matching.length === 0) {
        throw new Error(
          `No versions found for agent "${agentPromptId}" ` +
          `matching version constraint "${versionConstraint}"`
        );
      }

      return matching[0];
    }

    // Return latest version
    return active[0];
  }
}
```

---

## Reusability Patterns

### 1. Activity Composition

Break complex activities into smaller, reusable units:

#### Anti-Pattern: Monolithic Activity

```typescript
// ❌ BAD: One activity does everything
export async function buildAndTestAndFixPackage(input: BuildInput): Promise<void> {
  // Build
  await exec('yarn build', { cwd: input.packagePath });

  // Test
  await exec('yarn test', { cwd: input.packagePath });

  // Fix failures
  if (failures) {
    await spawnAgent(...);
  }

  // Publish
  await exec('npm publish', { cwd: input.packagePath });
}
```

#### Pattern: Composable Activities

```typescript
// ✅ GOOD: Small, focused, reusable activities
export async function runBuild(input: BuildInput): Promise<BuildResult> {
  return exec('yarn build', { cwd: input.packagePath });
}

export async function runTests(input: TestInput): Promise<TestResult> {
  return exec('yarn test', { cwd: input.packagePath });
}

export async function spawnFixAgent(input: FixInput): Promise<void> {
  return spawnAgent(...);
}

export async function publishPackage(input: PublishInput): Promise<PublishResult> {
  return exec('npm publish', { cwd: input.packagePath });
}

// Workflow composes activities
export async function PackageBuilderWorkflow(input: BuildInput): Promise<void> {
  const buildResult = await activities.runBuild(input);
  const testResult = await activities.runTests(input);

  if (!testResult.success) {
    await activities.spawnFixAgent({ failures: testResult.failures });
  }

  await activities.publishPackage(input);
}
```

---

### 2. Signal Contract Standardization

Use standardized signal payload format across all services:

```typescript
// File: packages/shared/temporal-contracts/src/signals.ts

/**
 * Standard signal payload for service-to-service communication
 */
export interface ServiceSignalPayload<T = unknown> {
  signalType: string;
  sourceService: string;
  targetService: string;
  packageId: string;
  timestamp: string; // ISO 8601
  priority?: 'low' | 'normal' | 'high' | 'critical';
  data?: T;
}

/**
 * Typed signal payloads for specific events
 */
export interface PlanWrittenSignal extends ServiceSignalPayload<{
  planFilePath: string;
  gitBranch: string;
}> {
  signalType: 'plan_written';
}

export interface BuildCompleteSignal extends ServiceSignalPayload<{
  gitBranch: string;
  testsPassed: boolean;
  buildDuration: number;
}> {
  signalType: 'build_complete';
}

export interface QAFailedSignal extends ServiceSignalPayload<{
  failures: QualityFailure[];
  gitBranch: string;
  qualityScore: number;
}> {
  signalType: 'qa_failed';
}
```

#### Usage in Workflows

```typescript
// File: packages/agents/package-builder-production/src/workflows/package-builder.workflow.ts

import { defineSignal, setHandler } from '@temporalio/workflow';
import type { QAFailedSignal } from '@bernierllc/temporal-contracts';

const reworkNeededSignal = defineSignal<[QAFailedSignal]>('rework_needed');

export async function PackageBuilderServiceWorkflow(): Promise<void> {
  const reworkQueue: QAFailedSignal[] = [];

  // Handle incoming rework signals from QA service
  setHandler(reworkNeededSignal, (signal: QAFailedSignal) => {
    console.log(`Received rework signal for ${signal.packageId}`);
    reworkQueue.push(signal);
  });

  while (true) {
    // Check for rework requests
    if (reworkQueue.length > 0) {
      const signal = reworkQueue.shift()!;
      await reworkPackage(signal);
      continue;
    }

    // Normal build process...
    await buildNextPackage();
  }
}
```

---

### 3. Shared Type Definitions

Centralize type definitions for cross-workflow reuse:

```typescript
// File: packages/shared/temporal-contracts/src/types.ts

export interface BuildResult {
  success: boolean;
  duration: number;
  stdout: string;
  stderr: string;
}

export interface TestResult {
  success: boolean;
  duration: number;
  coverage: number;
  stdout: string;
  stderr: string;
}

export interface QualityFailure {
  type: 'lint' | 'test' | 'build' | 'security';
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

export interface QualityResult {
  passed: boolean;
  duration: number;
  failures: QualityFailure[];
  stdout: string;
}
```

---

## Code Examples

### Complete Example: Activity with Metadata and Registry

```typescript
// File: packages/agents/package-builder-production/src/activities/quality.activities.ts

import { ActivityRegistry } from '@bernierllc/temporal-registry';
import type { ActivityMetadata, QualityResult } from '@bernierllc/temporal-contracts';

/**
 * Metadata for runQualityChecks activity
 */
export const runQualityChecksMetadata: ActivityMetadata = {
  name: 'runQualityChecks',
  displayName: 'Run quality validation (./manager validate-requirements)',
  description: 'Executes quality validation checks including tests, linting, and build verification',
  activityType: 'cli',
  version: '1.0.0',
  tags: ['quality', 'validation', 'cli'],
  expectedDurationMs: {
    min: 10000,
    avg: 30000,
    max: 120000
  }
};

// Auto-register
ActivityRegistry.register(runQualityChecksMetadata);

/**
 * Run quality validation checks
 */
export async function runQualityChecks(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<QualityResult> {
  const startTime = Date.now();
  const fullPath = path.join(input.workspaceRoot, input.packagePath);

  try {
    const { stdout } = await execAsync(
      './manager validate-requirements',
      { cwd: fullPath }
    );

    return {
      passed: true,
      duration: Date.now() - startTime,
      failures: [],
      stdout
    };
  } catch (error: any) {
    const stdout = error.stdout || '';
    const failures = parseQualityFailures(stdout);

    return {
      passed: false,
      duration: Date.now() - startTime,
      failures,
      stdout
    };
  }
}
```

---

### Complete Example: Dynamic Agent Selection

```typescript
// File: packages/agents/package-builder-production/src/workflows/fix-workflow.ts

import { proxyActivities } from '@temporalio/workflow';
import { VersionResolver } from '@bernierllc/temporal-registry';
import { AgentPromptRegistry } from '@bernierllc/agent-registry';

export async function FixFailuresWorkflow(input: {
  packagePath: string;
  planPath: string;
  failures: QualityFailure[];
}): Promise<void> {
  // Determine required capability based on failure types
  const failureTypes = [...new Set(input.failures.map(f => f.type))];

  let capability: string;
  if (failureTypes.includes('lint')) {
    capability = 'fix-linting-errors';
  } else if (failureTypes.includes('test')) {
    capability = 'fix-failing-tests';
  } else if (failureTypes.includes('build')) {
    capability = 'fix-build-errors';
  } else {
    capability = 'fix-failing-tests'; // Default
  }

  // Resolve activity dynamically
  const activityMetadata = VersionResolver.resolveActivity(capability, '^1.0.0');

  console.log(
    `Selected activity: ${activityMetadata.name} v${activityMetadata.version} ` +
    `for capability: ${capability}`
  );

  // Load agent prompt
  const promptVersion = await AgentPromptRegistry.getLatestPrompt(
    activityMetadata.agentPromptId!
  );

  console.log(
    `Using agent prompt: ${activityMetadata.agentPromptId} ` +
    `v${activityMetadata.agentPromptVersion}`
  );

  // Execute activity
  const activities = proxyActivities({
    startToCloseTimeout: '10 minutes'
  });

  await activities[activityMetadata.name]({
    packagePath: input.packagePath,
    planPath: input.planPath,
    failures: input.failures,
    agentPrompt: promptVersion
  });
}
```

---

## Tooling

### 1. CLI: List Components

```bash
# List all registered workflows
./manager registry workflows

# List all registered activities
./manager registry activities

# List activities by type
./manager registry activities --type agentic

# List agents by capability
./manager registry agents --capability fix-failing-tests

# Show specific component
./manager registry get-activity runBuild
./manager registry get-agent fix-agent
```

#### Implementation

```typescript
// File: production/scripts/registry-cli.ts

import { ActivityRegistry, WorkflowRegistry } from '@bernierllc/temporal-registry';
import { AgentPromptRegistry } from '@bernierllc/agent-registry';

async function main() {
  const command = process.argv[2];
  const subcommand = process.argv[3];

  switch (command) {
    case 'workflows':
      listWorkflows();
      break;
    case 'activities':
      if (subcommand === '--type') {
        listActivitiesByType(process.argv[4] as ActivityMetadata['activityType']);
      } else {
        listActivities();
      }
      break;
    case 'agents':
      if (subcommand === '--capability') {
        listAgentsByCapability(process.argv[4]);
      } else {
        listAgents();
      }
      break;
    case 'get-activity':
      showActivity(subcommand);
      break;
    case 'get-agent':
      showAgent(subcommand);
      break;
    default:
      console.log('Usage: ./manager registry [workflows|activities|agents|get-activity|get-agent]');
  }
}

function listWorkflows() {
  const workflows = WorkflowRegistry.list();

  console.log('Registered Workflows:');
  console.log('====================\n');

  for (const workflow of workflows) {
    console.log(`${workflow.workflowId} (v${workflow.version})`);
    console.log(`  Type: ${workflow.serviceType}`);
    console.log(`  Description: ${workflow.description}`);
    console.log(`  Signals To: ${workflow.signalsTo.join(', ')}`);
    console.log(`  Tags: ${workflow.tags?.join(', ') || 'none'}`);
    console.log();
  }
}

function listActivities() {
  const activities = ActivityRegistry.list();

  console.log('Registered Activities:');
  console.log('=====================\n');

  for (const activity of activities) {
    const deprecated = activity.deprecated ? ' [DEPRECATED]' : '';
    console.log(`${activity.name} (v${activity.version})${deprecated}`);
    console.log(`  Type: ${activity.activityType}`);
    console.log(`  Display: ${activity.displayName}`);
    console.log(`  Description: ${activity.description}`);

    if (activity.capabilities) {
      console.log(`  Capabilities: ${activity.capabilities.join(', ')}`);
    }

    if (activity.deprecated) {
      console.log(`  Migration: Use ${activity.deprecated.migrateToActivity} v${activity.deprecated.migrateToVersion}`);
    }

    console.log();
  }
}

async function listAgents() {
  await AgentPromptRegistry.loadIndex();
  const agents = AgentPromptRegistry.list();

  console.log('Registered Agent Prompts:');
  console.log('=========================\n');

  for (const agent of agents) {
    console.log(`${agent.agentPromptId} (latest: v${agent.latestVersion})`);
    console.log(`  Display: ${agent.displayName}`);
    console.log(`  Description: ${agent.description}`);
    console.log(`  Capabilities: ${agent.capabilities.join(', ')}`);
    console.log(`  Versions: ${agent.versions.length} available`);
    console.log();
  }
}

main();
```

---

### 2. CLI: Validate Metadata

```bash
# Validate all metadata files
./manager registry validate

# Validate specific component
./manager registry validate-activity runBuild
./manager registry validate-agent fix-agent
```

#### Implementation

```typescript
// File: production/scripts/validate-registry.ts

import Ajv from 'ajv';
import { ActivityMetadataSchema, WorkflowMetadataSchema, AgentPromptMetadataSchema } from '@bernierllc/temporal-contracts';

const ajv = new Ajv();

export function validateActivityMetadata(metadata: any): boolean {
  const validate = ajv.compile(ActivityMetadataSchema);
  const valid = validate(metadata);

  if (!valid) {
    console.error('Activity metadata validation failed:');
    console.error(validate.errors);
    return false;
  }

  // Additional business rules
  if (metadata.activityType === 'agentic') {
    if (!metadata.modelProvider || !metadata.modelName || !metadata.agentPromptId) {
      console.error('Agentic activities must have modelProvider, modelName, and agentPromptId');
      return false;
    }
  }

  return true;
}
```

---

### 3. CI/CD: Registry Validation

Add registry validation to CI pipeline:

```yaml
# File: .github/workflows/validate-registry.yml

name: Validate Component Registry

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: yarn install

      - name: Validate workflow metadata
        run: ./manager registry validate-workflows

      - name: Validate activity metadata
        run: ./manager registry validate-activities

      - name: Validate agent registry
        run: ./manager registry validate-agents

      - name: Check for deprecated components
        run: ./manager registry check-deprecations
```

---

## Summary

This document establishes comprehensive standards for component discoverability and reusability in the Temporal workflow ecosystem:

1. **Metadata Standards**: All workflows, activities, and agents have rich, structured metadata
2. **Registry Patterns**: Centralized registries enable runtime discovery by capability, type, or version
3. **Discovery Mechanisms**: Components can be found statically (compile-time) or dynamically (runtime)
4. **Version Management**: Semantic versioning with deprecation strategies ensures safe evolution
5. **Reusability Patterns**: Composable activities, standardized signals, and shared types maximize reuse
6. **Tooling**: CLI tools validate metadata and enable component exploration

### Next Steps

1. Implement `@bernierllc/temporal-registry` package
2. Implement `@bernierllc/agent-registry` package
3. Add metadata to existing workflows and activities
4. Build CLI tooling for registry operations
5. Add CI/CD validation for metadata

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-13 | Internal Docs Writer Agent | Initial standard document |

**Related Documents:**
- [Temporal Workflow Standardization and Service Architecture](../plans/2025-11-13-temporal-workflow-standardization-and-service-architecture.md)
- [Architecture Overview](../internal/architecture/)
- [Contributing Guidelines](../internal/contributing.md)
