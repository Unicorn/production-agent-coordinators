# Package Management Activities Plan

This document outlines additional npm/package management activities beyond basic install/build/publish, ranked from highest to lowest benefit for package builder workflows.

## Current State Analysis

### What We Have
- ✅ `publishPackage` - Basic npm publish with dry-run support
- ✅ `checkNpmPublished` - Check if package exists on npm
- ✅ `validatePackagePublishStatus` - Check publish status with version comparison
- ✅ `runBuild` / `runTests` - Execute npm scripts

### What's Missing
- ❌ Version bumping (semantic versioning)
- ❌ Dependency updates and management
- ❌ Vulnerability scanning
- ❌ License checking and compliance
- ❌ Package deprecation
- ❌ Package unpublishing (with safety checks)
- ❌ Registry management (scoped packages, access control)
- ❌ Package metadata updates (description, keywords, etc.)

---

## High Priority (Implement Soon)

### 1. Semantic Version Bumping
**Benefit:** Critical for release management and dependency tracking

**Use Cases:**
- Auto-bump version based on change type (major/minor/patch)
- Bump version before publishing
- Update dependent packages when dependency version changes
- Generate changelog entries

**Implementation:**
```typescript
export interface BumpVersionInput {
  packagePath: string;
  bumpType: 'major' | 'minor' | 'patch' | 'prerelease';
  prereleaseId?: string; // 'alpha', 'beta', 'rc'
  dryRun?: boolean;
}

export interface BumpVersionResult {
  success: boolean;
  oldVersion: string;
  newVersion: string;
  packageJsonPath: string;
  changes: string[]; // Files modified
  stdout: string;
  stderr?: string;
}
```

**Workflow Integration:**
- Before publishing updated packages
- After detecting breaking changes
- For prerelease versions during development

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

### 2. Dependency Update Management
**Benefit:** Keep dependencies current and secure

**Use Cases:**
- Check for outdated dependencies
- Update dependencies to latest versions
- Update dependencies to specific versions
- Handle peer dependency conflicts
- Update lock files (package-lock.json, yarn.lock)

**Implementation:**
```typescript
export interface CheckOutdatedDependenciesInput {
  packagePath: string;
  depth?: number; // Check transitive deps
}

export interface OutdatedDependency {
  package: string;
  current: string;
  wanted: string;
  latest: string;
  location: string; // 'dependencies' | 'devDependencies' | 'peerDependencies'
}

export interface CheckOutdatedDependenciesResult {
  success: boolean;
  outdated: OutdatedDependency[];
  total: number;
}

export interface UpdateDependenciesInput {
  packagePath: string;
  packages?: string[]; // Specific packages to update, or all if empty
  target?: 'latest' | 'minor' | 'patch';
  peerDependencies?: boolean;
}

export interface UpdateDependenciesResult {
  success: boolean;
  updated: Array<{
    package: string;
    oldVersion: string;
    newVersion: string;
  }>;
  conflicts?: Array<{
    package: string;
    conflict: string;
  }>;
  lockFileUpdated: boolean;
}
```

**Workflow Integration:**
- Periodic dependency updates
- Security vulnerability remediation
- Before publishing new packages

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

### 3. Vulnerability Scanning
**Benefit:** Security compliance and risk management

**Use Cases:**
- Scan dependencies for known vulnerabilities
- Generate security reports
- Block publishing if critical vulnerabilities exist
- Auto-fix vulnerabilities when possible

**Implementation:**
```typescript
export interface ScanVulnerabilitiesInput {
  packagePath: string;
  auditLevel?: 'low' | 'moderate' | 'high' | 'critical';
  fix?: boolean; // Auto-fix when possible
}

export interface Vulnerability {
  package: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  description: string;
  url: string;
  fixAvailable: boolean;
  fixVersion?: string;
  path: string; // Dependency path
}

export interface ScanVulnerabilitiesResult {
  success: boolean;
  vulnerabilities: Vulnerability[];
  summary: {
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
  fixed?: number; // If fix=true
  blocked: boolean; // True if critical/high vulnerabilities found
}
```

**Workflow Integration:**
- Pre-publish security check
- Periodic security audits
- CI/CD pipeline gates

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

### 4. License Checking and Compliance
**Benefit:** Legal compliance and license compatibility

**Use Cases:**
- Verify all dependencies have compatible licenses
- Check for license conflicts
- Generate license attribution files
- Ensure package license is set correctly

**Implementation:**
```typescript
export interface CheckLicensesInput {
  packagePath: string;
  allowedLicenses?: string[]; // Whitelist of allowed licenses
  blockedLicenses?: string[]; // Blacklist of blocked licenses
}

export interface LicenseInfo {
  package: string;
  license: string;
  licenseText?: string;
  author?: string;
  repository?: string;
}

export interface LicenseConflict {
  package: string;
  license: string;
  conflict: string; // Reason for conflict
}

export interface CheckLicensesResult {
  success: boolean;
  licenses: LicenseInfo[];
  conflicts: LicenseConflict[];
  allCompatible: boolean;
  attributionFile?: string; // Path to generated attribution file
}
```

**Workflow Integration:**
- Pre-publish license validation
- Generate LICENSE and NOTICE files
- Compliance reporting

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

## Medium Priority (Implement When Needed)

### 5. Package Deprecation Management
**Benefit:** Manage package lifecycle and migrations

**Use Cases:**
- Deprecate packages being replaced
- Set deprecation messages
- Track deprecation timeline
- Update dependent packages

**Implementation:**
```typescript
export interface DeprecatePackageInput {
  packageName: string;
  message: string;
  version?: string; // Deprecate specific version or all versions
}

export interface DeprecatePackageResult {
  success: boolean;
  deprecatedVersions: string[];
  message: string;
}
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### 6. Package Metadata Updates
**Benefit:** Update package information without republishing

**Use Cases:**
- Update package description
- Update keywords
- Update repository URL
- Update homepage
- Update bugs URL

**Implementation:**
```typescript
export interface UpdatePackageMetadataInput {
  packageName: string;
  metadata: {
    description?: string;
    keywords?: string[];
    repository?: string;
    homepage?: string;
    bugs?: string;
  };
}

export interface UpdatePackageMetadataResult {
  success: boolean;
  updated: string[];
}
```

**Note:** npm doesn't support updating metadata without republishing. This would require republishing with updated package.json.

**Estimated Value:** ⭐⭐ (2/5)

---

### 7. Package Unpublishing (with Safety Checks)
**Benefit:** Remove packages with proper safeguards

**Use Cases:**
- Unpublish packages that were published by mistake
- Remove deprecated packages after migration period
- Clean up test packages

**Implementation:**
```typescript
export interface UnpublishPackageInput {
  packageName: string;
  version?: string; // Unpublish specific version or all
  reason: string;
  force?: boolean; // Bypass safety checks (dangerous)
}

export interface UnpublishPackageResult {
  success: boolean;
  unpublishedVersions: string[];
  blocked: boolean; // True if safety checks prevented unpublish
  reason?: string; // Why it was blocked
}
```

**Safety Checks:**
- Check if other packages depend on it
- Require explicit confirmation
- Log unpublish events
- Respect npm's 72-hour unpublish window

**Estimated Value:** ⭐⭐ (2/5) - Rarely needed, but important when required

---

### 8. Registry and Access Management
**Benefit:** Manage scoped packages and access control

**Use Cases:**
- Configure registry for scoped packages
- Manage package access (public/restricted)
- Configure 2FA requirements
- Manage organization packages

**Implementation:**
```typescript
export interface ConfigureRegistryInput {
  scope: string; // '@bernierllc'
  registry: string;
  alwaysAuth?: boolean;
}

export interface SetPackageAccessInput {
  packageName: string;
  access: 'public' | 'restricted';
}

export interface RegistryConfig {
  scope: string;
  registry: string;
  alwaysAuth: boolean;
}
```

**Estimated Value:** ⭐⭐ (2/5) - Usually configured once, not frequently changed

---

## Lower Priority (Advanced Features)

### 9. Package Analytics and Insights
**Benefit:** Track package usage and health

**Use Cases:**
- Get download statistics
- Check package health scores
- Monitor package popularity
- Track version adoption

**Note:** Requires npm API access or third-party services.

**Estimated Value:** ⭐ (1/5) - Nice to have, not critical

---

### 10. Package Bundling and Distribution
**Benefit:** Create distribution packages

**Use Cases:**
- Create tarballs for distribution
- Generate checksums
- Create distribution manifests

**Estimated Value:** ⭐ (1/5) - npm handles this automatically

---

## Implementation Strategy

### Phase 1: High Priority (Next Sprint)
1. ✅ Semantic Version Bumping
2. ✅ Dependency Update Management
3. ✅ Vulnerability Scanning
4. ✅ License Checking and Compliance

### Phase 2: Medium Priority (When Needed)
5. Package Deprecation Management
6. Package Metadata Updates
7. Package Unpublishing (with Safety Checks)
8. Registry and Access Management

### Phase 3: Advanced (Lower Priority)
9. Package Analytics and Insights
10. Package Bundling and Distribution

---

## Integration with Existing Workflows

### Package Build Workflow
- Use `bumpVersion` before publishing
- Use `scanVulnerabilities` as quality gate
- Use `checkLicenses` for compliance

### Dependency Management Workflow
- Use `checkOutdatedDependencies` periodically
- Use `updateDependencies` for security updates
- Use `scanVulnerabilities` after updates

### Publishing Workflow
- Use `bumpVersion` if version not bumped
- Use `scanVulnerabilities` as pre-publish gate
- Use `checkLicenses` for compliance
- Use `deprecatePackage` for replaced packages

---

## Error Handling

### Common Error Scenarios
1. **Version conflicts:** Handle peer dependency conflicts gracefully
2. **Registry errors:** Handle npm registry downtime
3. **Authentication errors:** Clear error messages for auth issues
4. **Network errors:** Retry logic for transient failures
5. **Lock file conflicts:** Detect and handle lock file issues

---

## Security Considerations

### Vulnerability Scanning
- Use `npm audit` for vulnerability detection
- Integrate with Snyk or similar for enhanced scanning
- Block publishing on critical vulnerabilities
- Auto-fix when safe (patch updates)

### License Compliance
- Whitelist/blacklist license types
- Check license compatibility
- Generate attribution files
- Track license changes over time

---

## Dependencies Needed

```json
{
  "semver": "^7.5.0",  // Version parsing and comparison
  "npm-check-updates": "^16.0.0",  // Dependency updates
  "license-checker": "^25.0.0"  // License analysis
}
```

---

## Notes

- All activities should be **provider-agnostic** (work with both Gemini and Claude workflows)
- Consider using `npm` CLI commands vs. npm API (CLI is more reliable)
- Version bumping should follow semantic versioning strictly
- Vulnerability scanning should integrate with npm audit and potentially Snyk
- License checking should generate proper attribution files for compliance

