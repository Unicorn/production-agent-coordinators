# Manager CLI Activities Plan

This document outlines workflow activities that wrap all manager CLI commands from `~/projects/tools/mgr/manager.js`. These activities enable Temporal workflows to interact with the BernierLLC package management system for discovery, validation, publishing, tracking, and status management.

## Current State Analysis

### What We Have
- ✅ Basic npm publish activities (`publishPackage`)
- ✅ Package status checking (`checkNpmPublished`, `validatePackagePublishStatus`)
- ✅ Build/test activities (`runBuild`, `runTests`)

### What's Missing
- ❌ Manager CLI integration (all commands)
- ❌ Package discovery and listing
- ❌ Status tracking and synchronization
- ❌ Publication control (pause/resume)
- ❌ Configuration management
- ❌ Plan file synchronization
- ❌ Requirements validation
- ❌ Package taxonomy operations
- ❌ Build queue management
- ❌ Dependency analysis
- ❌ API integration (MCP)
- ❌ Package tracking lifecycle

### Manager CLI Context
The manager CLI (`./manager`) is a **backup method** for package management. The primary method uses specialized agents (95% token reduction, 10-20x faster). However, the CLI provides essential operations that workflows need:

- **Publishing to npm**: `./manager publish` (no OTP needed with Bypass 2FA token)
- **Status tracking**: Centralized status in `PACKAGE_STATUS.json`
- **Discovery**: Find and list packages by status, tags, categories
- **Validation**: Requirements, MECE compliance, configuration
- **Publication control**: Pause/resume publishing operations
- **API integration**: MCP server integration for package queries

---

## Requirements

### Core Requirements

1. **CLI Execution Wrapper**
   - Execute manager CLI commands from Temporal activities
   - Parse structured output (JSON where available)
   - Handle errors and exit codes
   - Support dry-run modes
   - Capture stdout/stderr

2. **Status Management**
   - Read/write `PACKAGE_STATUS.json`
   - Sync with NPM registry
   - Track package lifecycle (pending → in-progress → published)
   - Maintain tag index for MECE validation

3. **Discovery and Listing**
   - List packages by status, category, tags
   - Discover packages in repository
   - Enhanced status with NPM info
   - Search by taxonomy

4. **Validation and Compliance**
   - Validate package requirements
   - MECE compliance checking
   - Configuration validation
   - Validator package validation

5. **Publication Control**
   - Pause/resume publication operations
   - Check publication status
   - Duration-based pauses (24h, 2d, 1w, manual)

6. **Configuration Management**
   - Validate configuration files
   - Print resolved configuration
   - Show configuration inheritance
   - Check for undocumented overrides

7. **Plan File Synchronization**
   - Sync plan files with package status
   - Track plan files for packages
   - Move plans from pending/ to completed/

8. **API Integration**
   - Query packages via MCP API
   - Sync with API
   - Get build queue from API
   - Validate MECE via API

---

## High Priority Activities (Implement First)

### 1. Core Development Commands

#### 1.1 Publish Package Activity
**Benefit:** Critical for publishing packages to npm

**Purpose:**
- Publish packages to npm registry
- Support version bumping
- Handle OTP (if needed, though Bypass 2FA token preferred)
- Dry-run support

**Implementation:**
```typescript
export interface PublishPackageInput {
  package: string;
  bump?: 'major' | 'minor' | 'patch' | 'prerelease';
  message?: string;
  dryRun?: boolean;
  otp?: string; // Manual OTP if needed
}

export interface PublishPackageResult {
  success: boolean;
  package: string;
  version?: string;
  published: boolean;
  stdout: string;
  stderr?: string;
  error?: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

#### 1.2 Validate Package Activity
**Benefit:** Ensure package meets requirements before publishing

**Purpose:**
- Validate all packages or specific package
- Check requirements compliance
- Verify configuration

**Implementation:**
```typescript
export interface ValidatePackageInput {
  package?: string; // If undefined, validates all packages
  strict?: boolean;
}

export interface ValidatePackageResult {
  success: boolean;
  package?: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  requirementsMet: boolean;
  stdout: string;
  stderr?: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

#### 1.3 Check Package Activity
**Benefit:** Run development checks (linting, type checking)

**Purpose:**
- Run linting checks
- Type checking
- Development validation

**Implementation:**
```typescript
export interface CheckPackageInput {
  package?: string; // If undefined, checks all packages
}

export interface CheckPackageResult {
  success: boolean;
  package?: string;
  passed: boolean;
  lintErrors: number;
  typeErrors: number;
  stdout: string;
  stderr?: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

#### 1.4 Build Package Activity
**Benefit:** Build packages via manager CLI

**Purpose:**
- Build all packages or specific package
- Consistent with manager CLI interface

**Implementation:**
```typescript
export interface BuildPackageInput {
  package?: string; // If undefined, builds all packages
}

export interface BuildPackageResult {
  success: boolean;
  package?: string;
  built: boolean;
  stdout: string;
  stderr?: string;
  duration?: number;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

#### 1.5 Test Package Activity
**Benefit:** Run tests via manager CLI

**Purpose:**
- Run tests for all packages or specific package
- Consistent with manager CLI interface

**Implementation:**
```typescript
export interface TestPackageInput {
  package?: string; // If undefined, tests all packages
}

export interface TestPackageResult {
  success: boolean;
  package?: string;
  passed: boolean;
  testCount?: number;
  passedCount?: number;
  failedCount?: number;
  stdout: string;
  stderr?: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

### 2. Status & Discovery Commands

#### 2.1 Get Repository Status Activity
**Benefit:** Get overall repository status and progress

**Purpose:**
- Show repository status
- Package counts by status
- Progress metrics

**Implementation:**
```typescript
export interface GetRepositoryStatusInput {
  enhanced?: boolean; // Use status-enhanced command
  package?: string; // For enhanced status of specific package
}

export interface RepositoryStatus {
  total: number;
  pending: number;
  inProgress: number;
  published: number;
  completed: number;
  blocked: number;
  deprecated: number;
  progress: {
    percentage: number;
    completed: number;
    total: number;
  };
  npmInfo?: {
    // If enhanced=true
    version?: string;
    lastPublished?: string;
    downloads?: number;
  };
}

export interface GetRepositoryStatusResult {
  success: boolean;
  status: RepositoryStatus;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

#### 2.2 List Packages Activity
**Benefit:** List packages by various filters

**Purpose:**
- List packages by status (pending, published, completed, in-progress, planning, blocked, deprecated, all)
- List by category
- Filter packages for workflows

**Implementation:**
```typescript
export interface ListPackagesInput {
  filter: 'pending' | 'published' | 'completed' | 'in-progress' | 'planning' | 'blocked' | 'deprecated' | 'all' | string; // Category name
}

export interface PackageInfo {
  name: string;
  status: string;
  version?: string;
  category?: string;
  tags?: string[];
  lastChecked?: string;
}

export interface ListPackagesResult {
  success: boolean;
  packages: PackageInfo[];
  count: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

#### 2.3 Discover Packages Activity
**Benefit:** Discover all packages in repository

**Purpose:**
- Scan repository for packages
- Update package registry
- Initial discovery workflow

**Implementation:**
```typescript
export interface DiscoverPackagesInput {
  refresh?: boolean; // Force refresh
}

export interface DiscoverPackagesResult {
  success: boolean;
  packages: PackageInfo[];
  count: number;
  newPackages: number;
  updatedPackages: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

#### 2.4 Refresh Package Status Activity
**Benefit:** Sync package status from NPM

**Purpose:**
- Refresh status from NPM registry
- Update version information
- Sync publication status

**Implementation:**
```typescript
export interface RefreshPackageStatusInput {
  package?: string; // If undefined, refreshes all
}

export interface RefreshPackageStatusResult {
  success: boolean;
  refreshed: number;
  updated: number;
  errors: string[];
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

### 3. Package Tracking Commands

#### 3.1 Track Package Activity
**Benefit:** Update package status after publishing

**Purpose:**
- Mark package as completed after publishing
- Update status in PACKAGE_STATUS.json
- Move plan files to completed/

**Implementation:**
```typescript
export interface TrackPackageInput {
  package: string;
  status?: 'published' | 'completed' | 'in-progress';
  version?: string;
}

export interface TrackPackageResult {
  success: boolean;
  package: string;
  status: string;
  tracked: boolean;
  planFileMoved?: boolean;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

#### 3.2 Initialize Package Tracking Activity
**Benefit:** Set up package tracking system

**Purpose:**
- Initialize PACKAGE_STATUS.json
- Set up tracking infrastructure
- One-time setup

**Implementation:**
```typescript
export interface InitializePackageTrackingInput {
  force?: boolean; // Overwrite existing
}

export interface InitializePackageTrackingResult {
  success: boolean;
  initialized: boolean;
  packagesTracked: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 3.3 Track Plan File Activity
**Benefit:** Link plan files to packages

**Purpose:**
- Track plan file for a package
- Associate plans with package status
- Enable plan synchronization

**Implementation:**
```typescript
export interface TrackPlanFileInput {
  package: string;
  planPath: string;
}

export interface TrackPlanFileResult {
  success: boolean;
  package: string;
  planPath: string;
  tracked: boolean;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### 4. Publication Control Commands

#### 4.1 Pause Publication Activity
**Benefit:** Temporarily halt all publications

**Purpose:**
- Pause publications for specified duration
- Support time-based pauses (24h, 2d, 1w)
- Manual pause (until resume)
- Reason tracking

**Implementation:**
```typescript
export interface PausePublicationInput {
  duration?: string; // '24h', '2d', '1w', or 'manual'
  reason: string;
}

export interface PausePublicationResult {
  success: boolean;
  paused: boolean;
  until?: string; // ISO timestamp if time-based
  reason: string;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

#### 4.2 Resume Publication Activity
**Benefit:** Resume publications after pause

**Purpose:**
- Resume publication operations
- Force resume (override pause)
- Clear pause state

**Implementation:**
```typescript
export interface ResumePublicationInput {
  force?: boolean; // Force resume even if pause not expired
}

export interface ResumePublicationResult {
  success: boolean;
  resumed: boolean;
  wasPaused: boolean;
  pauseReason?: string;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

#### 4.3 Check Publication Status Activity
**Benefit:** Check if publications are paused

**Purpose:**
- Check pause status
- Get pause reason and duration
- JSON output for workflows

**Implementation:**
```typescript
export interface CheckPublicationStatusInput {
  json?: boolean; // Return structured JSON
}

export interface PublicationStatus {
  paused: boolean;
  reason?: string;
  until?: string; // ISO timestamp
  pausedAt?: string; // ISO timestamp
}

export interface CheckPublicationStatusResult {
  success: boolean;
  status: PublicationStatus;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

### 5. Configuration Management Commands

#### 5.1 Validate Configuration Activity
**Benefit:** Ensure configuration is valid

**Purpose:**
- Validate configuration files
- Check environment variables
- Strict mode validation

**Implementation:**
```typescript
export interface ValidateConfigurationInput {
  package?: string; // If undefined, validates all
  strict?: boolean;
}

export interface ConfigurationIssue {
  type: 'error' | 'warning';
  message: string;
  file?: string;
  variable?: string;
}

export interface ValidateConfigurationResult {
  success: boolean;
  package?: string;
  valid: boolean;
  issues: ConfigurationIssue[];
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

#### 5.2 Print Configuration Activity
**Benefit:** Get resolved configuration

**Purpose:**
- Print resolved configuration
- Show configuration sources
- Debug configuration issues

**Implementation:**
```typescript
export interface PrintConfigurationInput {
  package: string;
  showSources?: boolean;
}

export interface ConfigurationSource {
  source: string; // 'default', 'package.json', '.env', 'override'
  value: any;
  file?: string;
}

export interface PrintConfigurationResult {
  success: boolean;
  package: string;
  configuration: Record<string, any>;
  sources?: Record<string, ConfigurationSource>;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 5.3 Show Configuration Cascade Activity
**Benefit:** Understand configuration inheritance

**Purpose:**
- Show configuration inheritance tree
- Debug configuration resolution
- Understand override precedence

**Implementation:**
```typescript
export interface ShowConfigurationCascadeInput {
  package: string;
}

export interface ConfigurationNode {
  level: number;
  source: string;
  values: Record<string, any>;
  overrides: string[];
}

export interface ShowConfigurationCascadeResult {
  success: boolean;
  package: string;
  cascade: ConfigurationNode[];
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 5.4 Check Configuration Overrides Activity
**Benefit:** Find undocumented overrides

**Purpose:**
- Check for undocumented overrides
- Auto-fix override documentation
- Ensure configuration transparency

**Implementation:**
```typescript
export interface CheckConfigurationOverridesInput {
  package?: string; // If undefined, checks all
  fix?: boolean; // Auto-fix documentation
}

export interface ConfigurationOverride {
  package: string;
  key: string;
  value: any;
  documented: boolean;
  location: string;
}

export interface CheckConfigurationOverridesResult {
  success: boolean;
  overrides: ConfigurationOverride[];
  undocumented: number;
  fixed?: number; // If fix=true
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### 6. Plan Management Commands

#### 6.1 Sync Plans Activity
**Benefit:** Keep plan files in sync with package status

**Purpose:**
- Sync plan files with package status tracking
- Move plans from pending/ to completed/
- Update plan status

**Implementation:**
```typescript
export interface SyncPlansInput {
  dryRun?: boolean; // Preview changes without applying
}

export interface PlanSyncAction {
  package: string;
  planPath: string;
  action: 'move' | 'update' | 'create' | 'delete';
  from?: string;
  to?: string;
}

export interface SyncPlansResult {
  success: boolean;
  actions: PlanSyncAction[];
  moved: number;
  updated: number;
  created: number;
  deleted: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

#### 6.2 Get Plan Status Activity
**Benefit:** Show plan file status

**Purpose:**
- Show plan file status
- Track plan completion
- Identify missing plans

**Implementation:**
```typescript
export interface PlanStatus {
  package: string;
  hasPlan: boolean;
  planPath?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'missing';
  lastUpdated?: string;
}

export interface GetPlanStatusResult {
  success: boolean;
  plans: PlanStatus[];
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  missing: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### 7. Requirements & Validation Commands

#### 7.1 Validate Requirements Activity
**Benefit:** Ensure package meets requirements

**Purpose:**
- Validate package requirements
- Check compliance with standards
- Identify missing requirements

**Implementation:**
```typescript
export interface ValidateRequirementsInput {
  package?: string; // If undefined, validates all
}

export interface RequirementCheck {
  requirement: string;
  met: boolean;
  message?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidateRequirementsResult {
  success: boolean;
  package?: string;
  valid: boolean;
  checks: RequirementCheck[];
  errors: number;
  warnings: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

#### 7.2 Get Requirements Status Activity
**Benefit:** Show requirements status for all packages

**Purpose:**
- Get requirements compliance overview
- Identify packages needing attention
- Track requirements progress

**Implementation:**
```typescript
export interface PackageRequirementsStatus {
  package: string;
  valid: boolean;
  errors: number;
  warnings: number;
  checks: RequirementCheck[];
}

export interface GetRequirementsStatusResult {
  success: boolean;
  packages: PackageRequirementsStatus[];
  total: number;
  valid: number;
  invalid: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

#### 7.3 Validate Validators Activity
**Benefit:** Ensure validator packages are correct

**Purpose:**
- Validate validator packages
- Check validator naming conventions
- Ensure validators are properly configured

**Implementation:**
```typescript
export interface ValidateValidatorsInput {
  package?: string; // If undefined, validates all validators
}

export interface ValidatorIssue {
  validator: string;
  issue: string;
  severity: 'error' | 'warning';
}

export interface ValidateValidatorsResult {
  success: boolean;
  valid: boolean;
  issues: ValidatorIssue[];
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 7.4 Validate MECE Activity
**Benefit:** Ensure MECE (Mutually Exclusive, Collectively Exhaustive) compliance

**Purpose:**
- Validate package taxonomy is MECE compliant
- Check tag exclusivity
- Ensure complete coverage

**Implementation:**
```typescript
export interface ValidateMECEInput {
  package: string;
}

export interface MECEViolation {
  type: 'overlap' | 'gap' | 'inconsistency';
  packages: string[];
  tags: string[];
  message: string;
}

export interface ValidateMECEResult {
  success: boolean;
  package: string;
  compliant: boolean;
  violations: MECEViolation[];
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

### 8. Package Taxonomy Commands

#### 8.1 Search by Tag Activity
**Benefit:** Find packages by taxonomy tags

**Purpose:**
- Search packages by tag
- Filter packages for workflows
- Taxonomy-based discovery

**Implementation:**
```typescript
export interface SearchByTagInput {
  tag: string;
}

export interface SearchByTagResult {
  success: boolean;
  tag: string;
  packages: PackageInfo[];
  count: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

#### 8.2 Get Tag Statistics Activity
**Benefit:** Understand package taxonomy

**Purpose:**
- Show tag statistics
- Identify popular tags
- Taxonomy health metrics

**Implementation:**
```typescript
export interface TagStatistic {
  tag: string;
  count: number;
  packages: string[];
}

export interface GetTagStatisticsResult {
  success: boolean;
  tags: TagStatistic[];
  totalTags: number;
  totalPackages: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 8.3 Get Suite Status Activity
**Benefit:** Show status for package suites

**Purpose:**
- Show status for suite of packages (by suite tag)
- Track suite completion
- Suite-level progress

**Implementation:**
```typescript
export interface GetSuiteStatusInput {
  suiteTag: string;
}

export interface SuiteStatus {
  suiteTag: string;
  packages: PackageInfo[];
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  progress: {
    percentage: number;
    completed: number;
    total: number;
  };
}

export interface GetSuiteStatusResult {
  success: boolean;
  status: SuiteStatus;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### 9. Build Queue Commands

#### 9.1 Get Build Queue Activity
**Benefit:** Manage build queue

**Purpose:**
- Show build queue status
- Prioritize builds
- Queue management

**Implementation:**
```typescript
export interface BuildQueueItem {
  package: string;
  priority: number;
  queuedAt: string;
  status: 'queued' | 'building' | 'completed' | 'failed';
}

export interface GetBuildQueueResult {
  success: boolean;
  queue: BuildQueueItem[];
  total: number;
  queued: number;
  building: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### 10. Dependency Commands

#### 10.1 Get Package Dependencies Activity
**Benefit:** Analyze package dependencies

**Purpose:**
- Show package dependencies
- Dependency hierarchy
- Dependency status and importance

**Implementation:**
```typescript
export interface GetPackageDependenciesInput {
  package: string;
  hierarchy?: boolean; // Show full hierarchy
  alpha?: boolean; // Sort alphabetically
  status?: boolean; // Include status
  dependencyType?: 'dependencies' | 'devDependencies' | 'peerDependencies' | 'all';
  importance?: boolean; // Show importance
}

export interface DependencyInfo {
  package: string;
  version: string;
  type: 'dependencies' | 'devDependencies' | 'peerDependencies';
  status?: 'published' | 'pending' | 'in-progress';
  importance?: 'critical' | 'high' | 'medium' | 'low';
  dependencies?: DependencyInfo[]; // If hierarchy=true
}

export interface GetPackageDependenciesResult {
  success: boolean;
  package: string;
  dependencies: DependencyInfo[];
  total: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

### 11. Version & Status Commands

#### 11.1 Check Versions Activity
**Benefit:** Verify package versions

**Purpose:**
- Check package versions
- Version consistency
- Version conflicts

**Implementation:**
```typescript
export interface CheckVersionsResult {
  success: boolean;
  packages: Array<{
    package: string;
    localVersion?: string;
    npmVersion?: string;
    match: boolean;
    conflict?: string;
  }>;
  mismatches: number;
  conflicts: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 11.2 Check Ready Activity
**Benefit:** Verify packages are ready for publishing

**Purpose:**
- Check if packages are ready
- Pre-publish validation
- Readiness checklist

**Implementation:**
```typescript
export interface CheckReadyInput {
  packages?: string[]; // If undefined, checks all
}

export interface PackageReadiness {
  package: string;
  ready: boolean;
  checks: Array<{
    check: string;
    passed: boolean;
    message?: string;
  }>;
}

export interface CheckReadyResult {
  success: boolean;
  packages: PackageReadiness[];
  ready: number;
  notReady: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

## Medium Priority Activities (Implement When Needed)

### 12. API Commands (MCP Integration)

#### 12.1 Test API Connection Activity
**Benefit:** Verify API connectivity

**Purpose:**
- Test connection to MCP API
- Verify authentication
- Health check

**Implementation:**
```typescript
export interface TestAPIConnectionResult {
  success: boolean;
  connected: boolean;
  apiUrl: string;
  responseTime?: number;
  error?: string;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 12.2 Query Packages via API Activity
**Benefit:** Query packages through MCP API

**Purpose:**
- Query packages via API
- Filter and search
- API-based discovery

**Implementation:**
```typescript
export interface QueryPackagesViaAPIInput {
  query?: string;
  filter?: Record<string, any>;
}

export interface QueryPackagesViaAPIResult {
  success: boolean;
  packages: PackageInfo[];
  count: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 12.3 Get Package Info via API Activity
**Benefit:** Get package information from API

**Purpose:**
- Get detailed package info
- API-based status
- Remote package data

**Implementation:**
```typescript
export interface GetPackageInfoViaAPIInput {
  package: string;
}

export interface GetPackageInfoViaAPIResult {
  success: boolean;
  package: string;
  info: PackageInfo;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 12.4 Retry Pending API Operations Activity
**Benefit:** Retry failed API operations

**Purpose:**
- Retry pending API operations
- Handle transient failures
- Queue management

**Implementation:**
```typescript
export interface RetryPendingAPIOperationsResult {
  success: boolean;
  retried: number;
  succeeded: number;
  failed: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 12.5 Get Pending API Operations Status Activity
**Benefit:** Check pending API operations

**Purpose:**
- Check pending operations
- Monitor API queue
- Status tracking

**Implementation:**
```typescript
export interface PendingAPIOperation {
  id: string;
  type: string;
  package?: string;
  status: 'pending' | 'processing' | 'failed';
  createdAt: string;
  error?: string;
}

export interface GetPendingAPIOperationsStatusResult {
  success: boolean;
  operations: PendingAPIOperation[];
  total: number;
  pending: number;
  processing: number;
  failed: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 12.6 Sync with API Activity
**Benefit:** Synchronize with MCP API

**Purpose:**
- Sync package status with API
- Two-way synchronization
- Conflict resolution

**Implementation:**
```typescript
export interface SyncWithAPIInput {
  direction?: 'pull' | 'push' | 'both';
  package?: string; // If undefined, syncs all
}

export interface SyncWithAPIResult {
  success: boolean;
  synced: number;
  updated: number;
  conflicts: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 12.7 Get Build Queue from API Activity
**Benefit:** Get build queue from API

**Purpose:**
- Get build queue via API
- Remote queue management
- API-based prioritization

**Implementation:**
```typescript
export interface GetBuildQueueFromAPIResult {
  success: boolean;
  queue: BuildQueueItem[];
  total: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 12.8 Validate MECE via API Activity
**Benefit:** Validate MECE compliance via API

**Purpose:**
- Validate MECE via API
- Remote validation
- API-based compliance checking

**Implementation:**
```typescript
export interface ValidateMECEViaAPIInput {
  package: string;
}

export interface ValidateMECEViaAPIResult {
  success: boolean;
  package: string;
  compliant: boolean;
  violations: MECEViolation[];
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 12.9 Get Status via API Activity
**Benefit:** Get package status via API

**Purpose:**
- Get status from API
- Remote status checking
- API-based status sync

**Implementation:**
```typescript
export interface GetStatusViaAPIInput {
  package?: string; // If undefined, gets all
}

export interface GetStatusViaAPIResult {
  success: boolean;
  package?: string;
  status: RepositoryStatus | PackageInfo;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

## Lower Priority Activities (Utility Commands)

### 13. Utility Commands

#### 13.1 Test TOTP Activity
**Benefit:** Test TOTP generation (legacy, deprecated)

**Purpose:**
- Test TOTP generation from NPM_TOTP_SECRET
- Legacy support (deprecated in favor of Bypass 2FA tokens)

**Note:** This is deprecated. Bypass 2FA tokens are preferred.

**Estimated Value:** ⭐ (1/5)

---

#### 13.2 Check Lock Status Activity
**Benefit:** Check file lock status

**Purpose:**
- Check file lock status
- Debug locking issues
- Monitor lock health

**Implementation:**
```typescript
export interface LockInfo {
  file: string;
  locked: boolean;
  pid?: number;
  lockedAt?: string;
  stale?: boolean;
}

export interface CheckLockStatusResult {
  success: boolean;
  locks: LockInfo[];
  total: number;
  active: number;
  stale: number;
  stdout: string;
}
```

**Estimated Value:** ⭐⭐ (2/5)

---

## Implementation Strategy

### Phase 1: High Priority (Next Sprint)
1. ✅ **Core Development Commands**
   - Publish Package Activity
   - Validate Package Activity
   - Check Package Activity
   - Build Package Activity
   - Test Package Activity

2. ✅ **Status & Discovery Commands**
   - Get Repository Status Activity
   - List Packages Activity
   - Discover Packages Activity
   - Refresh Package Status Activity

3. ✅ **Package Tracking Commands**
   - Track Package Activity
   - Initialize Package Tracking Activity

4. ✅ **Publication Control Commands**
   - Pause Publication Activity
   - Resume Publication Activity
   - Check Publication Status Activity

5. ✅ **Requirements & Validation Commands**
   - Validate Requirements Activity
   - Get Requirements Status Activity
   - Validate MECE Activity

### Phase 2: Medium Priority (When Needed)
6. **Configuration Management Commands**
   - Validate Configuration Activity
   - Print Configuration Activity
   - Show Configuration Cascade Activity
   - Check Configuration Overrides Activity

7. **Plan Management Commands**
   - Sync Plans Activity
   - Get Plan Status Activity

8. **Package Taxonomy Commands**
   - Search by Tag Activity
   - Get Tag Statistics Activity
   - Get Suite Status Activity

9. **Dependency Commands**
   - Get Package Dependencies Activity

10. **Version & Status Commands**
    - Check Versions Activity
    - Check Ready Activity

11. **Build Queue Commands**
    - Get Build Queue Activity

### Phase 3: API Integration (When MCP Available)
12. **API Commands**
    - Test API Connection Activity
    - Query Packages via API Activity
    - Get Package Info via API Activity
    - Retry Pending API Operations Activity
    - Get Pending API Operations Status Activity
    - Sync with API Activity
    - Get Build Queue from API Activity
    - Validate MECE via API Activity
    - Get Status via API Activity

### Phase 4: Utility (Lower Priority)
13. **Utility Commands**
    - Check Lock Status Activity
    - Test TOTP Activity (deprecated)

---

## Common Implementation Pattern

### Base CLI Execution Activity

All manager CLI activities should follow this pattern:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execPromise = promisify(exec);

/**
 * Execute a manager CLI command
 */
export async function executeManagerCommand(
  command: string,
  args: string[] = [],
  options: {
    workingDir?: string;
    timeout?: number;
    env?: Record<string, string>;
  } = {}
): Promise<{
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  const { workingDir, timeout = 300000, env = {} } = options;
  
  // Manager CLI is in ~/projects/tools/mgr
  const managerPath = path.join(process.env.HOME || '', 'projects/tools/mgr/manager');
  
  const fullCommand = `${managerPath} ${command} ${args.join(' ')}`;
  
  try {
    const { stdout, stderr } = await execPromise(fullCommand, {
      cwd: workingDir || process.cwd(),
      timeout,
      env: { ...process.env, ...env },
    });
    
    return {
      success: true,
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (error: any) {
    return {
      success: false,
      exitCode: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      error: error.message,
    };
  }
}
```

### JSON Output Parsing

For commands that support JSON output, parse the stdout:

```typescript
export function parseManagerJSONOutput(stdout: string): any {
  try {
    // Some commands output JSON directly
    return JSON.parse(stdout);
  } catch {
    // Some commands output JSON in a code block or mixed with text
    // Extract JSON from markdown code blocks or mixed output
    const jsonMatch = stdout.match(/```json\n([\s\S]*?)\n```/) || 
                     stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    }
    throw new Error('No JSON found in output');
  }
}
```

---

## Integration with Existing Workflows

### Package Build Workflow
- Use `validatePackage` before building
- Use `checkPackage` after building
- Use `publishPackage` to publish
- Use `trackPackage` after publishing

### Package Discovery Workflow
- Use `discoverPackages` to find packages
- Use `listPackages` to filter by status
- Use `getRepositoryStatus` for progress tracking

### Publication Workflow
- Use `checkPublicationStatus` before publishing
- Use `pausePublication` to halt publications
- Use `resumePublication` to resume
- Use `publishPackage` to publish
- Use `trackPackage` after publishing

### Validation Workflow
- Use `validateRequirements` for requirements check
- Use `validateMECE` for taxonomy compliance
- Use `validateConfiguration` for config validation
- Use `checkReady` before publishing

---

## Error Handling

### Common Error Scenarios

1. **Manager CLI Not Found**
   - Error: Manager CLI not installed or wrong path
   - Solution: Check `~/projects/tools/mgr/manager` exists
   - Fallback: Return error with clear message

2. **NPM Authentication Errors**
   - Error: NPM token expired or invalid
   - Solution: Check NPM_TOKEN in environment
   - Fallback: Return error with token renewal instructions

3. **Package Not Found**
   - Error: Package doesn't exist in repository
   - Solution: Use `discoverPackages` first
   - Fallback: Return error with package name

4. **File Lock Conflicts**
   - Error: PACKAGE_STATUS.json is locked
   - Solution: Retry with exponential backoff
   - Fallback: Check lock status and wait

5. **Publication Paused**
   - Error: Publications are paused
   - Solution: Check pause status before publishing
   - Fallback: Return error with pause reason

---

## Security Considerations

### NPM Token Management
- Tokens stored in environment variables
- Bypass 2FA tokens preferred (no OTP needed)
- Token expiration tracking (90 days max)
- Automatic warnings 14 days before expiration

### File Locking
- Atomic file operations
- Exponential backoff for lock conflicts
- Stale lock detection (60 seconds)
- Timeout protection (30 seconds)

### Input Validation
- Validate package names
- Sanitize command arguments
- Prevent command injection
- Validate file paths

---

## Dependencies Needed

```json
{
  "child_process": "built-in",
  "path": "built-in",
  "util": "built-in"
}
```

No external dependencies required - uses Node.js built-ins.

---

## Notes

- **Manager CLI Location**: `~/projects/tools/mgr/manager`
- **Status File**: `~/projects/tools/plans/packages/PACKAGE_STATUS.json`
- **Plan Files**: `~/projects/tools/plans/packages/pending/` and `completed/`
- **CLI is Backup Method**: Primary method uses agents (95% token reduction)
- **Bypass 2FA Tokens**: Preferred over TOTP (deprecated)
- **File Locking**: Atomic operations with exponential backoff
- **JSON Output**: Some commands support `--json` flag for structured output
- **Dry-Run Support**: Many commands support `--dry-run` for preview

---

## Related Documentation

- **Manager CLI README**: `~/projects/tools/mgr/README.md`
- **Agent Workflows**: `~/projects/tools/docs/AGENT_WORKFLOWS.md`
- **Package Status Tracking**: `~/projects/tools/plans/packages/PACKAGE_STATUS.json`
- **MCP API Documentation**: See mbernier.com API documentation

