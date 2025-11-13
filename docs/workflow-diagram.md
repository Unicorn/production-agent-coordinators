# Autonomous Package Workflow Diagram

## Complete Workflow Overview

```mermaid
graph TD
    Start[User Input: Package Name/Idea/Path/Prompt] --> Discovery

    Discovery[Phase 1: DISCOVERY] --> DiscoveryActivities
    DiscoveryActivities[Parse Input<br/>Search Package<br/>Read package.json<br/>Build Dep Tree<br/>Check npm Status<br/>Setup Worktree<br/>Copy .env Files] --> Planning

    Planning[Phase 2: PLANNING] --> PlanCheck{Plan Exists?}
    PlanCheck -->|Yes| ValidatePlan[Validate Plan<br/>Register with MCP]
    PlanCheck -->|No| AskUser{Ask User:<br/>Provide Plan<br/>or Cancel?}
    AskUser -->|Provide Plan| ValidatePlan
    AskUser -->|Cancel| End[End Workflow]
    ValidatePlan --> MECE

    MECE[Phase 3: MECE VALIDATION] --> AnalyzeMECE[Analyze MECE Compliance]
    AnalyzeMECE --> MECECheck{Violation<br/>Detected?}
    MECECheck -->|No| BuildPhase
    MECECheck -->|Yes| GenerateSplits[Generate Split Plans<br/>Register with MCP]
    GenerateSplits --> IsPublished{Package<br/>Published?}
    IsPublished -->|Yes| DeprecationCycle[Create Deprecation Cycle:<br/>Minor: Add deprecation notice<br/>Major: Split functionality]
    IsPublished -->|No| DirectSplit[Create MECE Split Packages]
    DeprecationCycle --> AddToSuite[Add All Packages to Suite]
    DirectSplit --> AddToSuite
    AddToSuite --> BuildPhase

    BuildPhase[Phase 4: BUILD] --> CreateGraph[Create Dependency Graph<br/>Topological Sort]
    CreateGraph --> SpawnChildren[Spawn Child Workflows<br/>for Each Package]
    SpawnChildren --> ChildWorkflow

    ChildWorkflow[Child: PackageBuildWorkflow] --> BuildPkg[Activity: runBuild<br/>yarn build]
    BuildPkg --> BuildSuccess{Build<br/>Success?}
    BuildSuccess -->|No| ReportBuildFail[Report Build Failure]
    BuildSuccess -->|Yes| QualityPhase

    QualityPhase[Quality Checks] --> QualityActivities[Run in Parallel:<br/>1. Structure Validation<br/>2. TypeScript Check<br/>3. Lint Check<br/>4. Tests + Coverage<br/>5. Security Audit<br/>6. Documentation<br/>7. License Headers<br/>8. Integration Points]
    QualityActivities --> CalcScore[Calculate Compliance Score]
    CalcScore --> ScoreCheck{Score >= 85%?}
    ScoreCheck -->|Yes| PublishPhase
    ScoreCheck -->|No| RemedAttempts{Attempts < 3?}
    RemedAttempts -->|Yes| GenerateRemediation[Generate Remediation Report]
    GenerateRemediation --> RemediationAgent[Spawn RemediationWorkflow]
    RemediationAgent --> AgentFixes[Agent Fixes Issues]
    AgentFixes --> QualityActivities
    RemedAttempts -->|No| SkipPublish[Skip Publishing<br/>Continue Suite]

    PublishPhase[Phase 5: PUBLISH] --> VersionBump[Determine Version Bump]
    VersionBump --> NpmPublish[npm publish<br/>Default: Private]
    NpmPublish --> UpdateDeps[Update Dependent Versions]
    UpdateDeps --> ReportPackage[Report Package Success]

    SkipPublish --> ReportSkipped[Report Package Skipped]
    ReportBuildFail --> ReportSkipped

    ReportPackage --> MorePackages{More Packages<br/>in Suite?}
    ReportSkipped --> MorePackages
    MorePackages -->|Yes| SpawnChildren
    MorePackages -->|No| CompletePhase

    CompletePhase[Phase 6: COMPLETE] --> GatherReports[Gather All Package Reports]
    GatherReports --> WriteSuiteReport[Write Suite Report:<br/>- Packages Built<br/>- Quality Scores<br/>- Remediation Attempts<br/>- MECE Resolutions<br/>- New Packages Created<br/>- Deprecation Cycles]
    WriteSuiteReport --> End

    style Start fill:#e1f5ff
    style Discovery fill:#fff4e6
    style Planning fill:#fff4e6
    style MECE fill:#fff4e6
    style BuildPhase fill:#e8f5e9
    style QualityPhase fill:#f3e5f5
    style PublishPhase fill:#e8f5e9
    style CompletePhase fill:#e8f5e9
    style End fill:#e1f5ff
    style RemediationAgent fill:#ffebee
```

## Phase 1: Discovery (Detailed)

```mermaid
graph TD
    Input[User Input] --> Parse[Parse Input Type]
    Parse --> TypeCheck{Input Type?}
    TypeCheck -->|Package Name| SearchByName[Search by Name]
    TypeCheck -->|Package Idea| SearchByIdea[Search by Keywords]
    TypeCheck -->|Plan Path| SearchByPath[Load Plan File]
    TypeCheck -->|Update Prompt| SearchByName

    SearchByName --> Search1[Check ./plans/packages/**]
    Search1 --> Found1{Found?}
    Found1 -->|No| Search2[Check ./packages/**]
    Search2 --> Found2{Found?}
    Found2 -->|No| Search3[Query packages-api MCP]
    Search3 --> Found3{Found?}
    Found3 -->|No| AskUser[Ask User:<br/>Correct name?<br/>Try different branch?]
    Found3 -->|Yes| PackageFound
    Found2 -->|Yes| PackageFound
    Found1 -->|Yes| PackageFound

    SearchByIdea --> Search3
    SearchByPath --> ValidatePath{Path Valid?}
    ValidatePath -->|Yes| PackageFound
    ValidatePath -->|No| AskUser

    PackageFound[Package Located] --> ReadPkg[Read package.json]
    ReadPkg --> BuildTree[Build Dependency Tree<br/>Recursive Discovery]
    BuildTree --> CheckNpm[Check npm Status via MCP]
    CheckNpm --> SetupWt[Setup Worktree]
    SetupWt --> CopyEnv[Copy .env Files:<br/>- Root .env<br/>- mgr/.env]
    CopyEnv --> Output[Output: Package Manifest]

    style Input fill:#e1f5ff
    style Output fill:#c8e6c9
```

## Phase 3: MECE Validation (Detailed)

```mermaid
graph TD
    Start[MECE Validation Phase] --> Analyze[Analyze MECE Compliance]
    Analyze --> Query[Query packages-api MCP<br/>with Update Context]
    Query --> ViolationCheck{MECE<br/>Violation?}

    ViolationCheck -->|No| NoAction[No MECE Issues]
    NoAction --> Complete[Phase Complete]

    ViolationCheck -->|Yes| IdentifyViolation[Identify Violation Details:<br/>- What functionality violates?<br/>- What new packages needed?<br/>- Dependency relationships?]

    IdentifyViolation --> GenPlans[Generate Plans for<br/>MECE Split Packages]
    GenPlans --> RegisterPlans[Register Plans with MCP]

    RegisterPlans --> PublishedCheck{Current Package<br/>Already Published?}

    PublishedCheck -->|No| CreateNew[Create New MECE Packages<br/>Add to Suite]
    CreateNew --> Complete

    PublishedCheck -->|Yes| DeprecationFlow[Deprecation Cycle Required]
    DeprecationFlow --> MinorBump[Package A v1.1.0:<br/>Add deprecation notice<br/>Update docs]
    MinorBump --> MajorBump[Package A v2.0.0:<br/>Remove split functionality<br/>Add dependency if needed]
    MajorBump --> NewPackage[Package B v1.0.0:<br/>New package with<br/>split functionality]
    NewPackage --> UpdateDeps[Find Dependent Packages]
    UpdateDeps --> CascadeUpdates[Update Dependent Plans<br/>Bump Versions]
    CascadeUpdates --> AddAll[Add All Packages to Suite:<br/>- Original package (2 versions)<br/>- New MECE package<br/>- Updated dependents]
    AddAll --> Complete

    style Start fill:#fff4e6
    style Complete fill:#c8e6c9
    style DeprecationFlow fill:#ffebee
```

## Phase 4.1: Quality Checks (Detailed)

```mermaid
graph TD
    Start[Quality Phase] --> Attempt{Attempt < 3?}
    Attempt -->|No| Failed[Max Attempts Reached<br/>Skip Publishing]
    Attempt -->|Yes| ParallelChecks[Run All Checks in Parallel]

    ParallelChecks --> C1[1. Structure Validation]
    ParallelChecks --> C2[2. TypeScript Check]
    ParallelChecks --> C3[3. Lint Check]
    ParallelChecks --> C4[4. Tests + Coverage]
    ParallelChecks --> C5[5. Security Audit]
    ParallelChecks --> C6[6. Documentation]
    ParallelChecks --> C7[7. License Headers]
    ParallelChecks --> C8[8. Integration Points]

    C1 --> Calc[Calculate Compliance Score]
    C2 --> Calc
    C3 --> Calc
    C4 --> Calc
    C5 --> Calc
    C6 --> Calc
    C7 --> Calc
    C8 --> Calc

    Calc --> ScoreCheck{Score?}
    ScoreCheck -->|95-100%| Excellent[Excellent<br/>Publish Immediately]
    ScoreCheck -->|90-94%| Good[Good<br/>Publish with Warnings]
    ScoreCheck -->|85-89%| Acceptable[Acceptable<br/>Publish with Confirmation]
    ScoreCheck -->|Below 85%| NeedsWork[Needs Remediation]

    Excellent --> Success[Quality Passed]
    Good --> Success
    Acceptable --> Success

    NeedsWork --> BuildReport[Build Remediation Report:<br/>- TypeScript errors<br/>- Lint issues<br/>- Test failures<br/>- Coverage gaps<br/>- Security vulns<br/>- Doc missing<br/>- License issues<br/>- Integration gaps]

    BuildReport --> PrioritizeTasks[Prioritize Tasks:<br/>Critical → High → Medium → Low]
    PrioritizeTasks --> SpawnRemed[Spawn RemediationWorkflow]
    SpawnRemed --> AgentWorks[Agent Fixes Issues<br/>Autonomously]
    AgentWorks --> IncrementAttempt[Increment Attempt Counter]
    IncrementAttempt --> Attempt

    style Start fill:#f3e5f5
    style Success fill:#c8e6c9
    style Failed fill:#ffcdd2
    style SpawnRemed fill:#ffebee
```

## Child Workflows Overview

```mermaid
graph LR
    Main[Main: PackageBuilderWorkflow] --> Child1[Child: PackageBuildWorkflow<br/>Package A]
    Main --> Child2[Child: PackageBuildWorkflow<br/>Package B]
    Main --> Child3[Child: PackageBuildWorkflow<br/>Package C]

    Child1 --> Remed1[RemediationWorkflow<br/>if needed]
    Child2 --> Remed2[RemediationWorkflow<br/>if needed]
    Child3 --> Remed3[RemediationWorkflow<br/>if needed]

    Child1 --> Report1[Report to Main]
    Child2 --> Report2[Report to Main]
    Child3 --> Report3[Report to Main]

    Report1 --> Main
    Report2 --> Main
    Report3 --> Main

    style Main fill:#e1f5ff
    style Child1 fill:#fff4e6
    style Child2 fill:#fff4e6
    style Child3 fill:#fff4e6
    style Remed1 fill:#ffebee
    style Remed2 fill:#ffebee
    style Remed3 fill:#ffebee
```

## Data Flow Through Phases

```mermaid
graph LR
    Input[Minimal Input:<br/>Name/Idea/Path/Prompt] --> D[Discovery Phase]
    D --> DOut[Package Manifest:<br/>- Name, Path, Version<br/>- Dependencies<br/>- npm Status<br/>- Worktree Path]

    DOut --> P[Planning Phase]
    P --> POut[Validated Plans:<br/>- Main package plan<br/>- Dependency plans<br/>- Registered with MCP]

    POut --> M[MECE Phase]
    M --> MOut[Complete Suite:<br/>- Main package<br/>- Dependencies<br/>- MECE splits<br/>- Deprecation versions<br/>- Updated dependents]

    MOut --> B[Build Phase]
    B --> BOut[Build Results:<br/>- Build success/fail<br/>- Quality scores<br/>- Remediation attempts<br/>- Test results]

    BOut --> Pub[Publish Phase]
    Pub --> PubOut[Publish Results:<br/>- Published versions<br/>- npm URLs<br/>- Deprecation notices<br/>- Updated consumers]

    PubOut --> C[Complete Phase]
    C --> COut[Final Report:<br/>- All packages<br/>- Quality metrics<br/>- MECE resolutions<br/>- New packages created]

    style Input fill:#e1f5ff
    style COut fill:#c8e6c9
```

## Key Decision Points

### 1. Package Discovery
- **Decision**: Package not found locally
- **Options**: Query MCP, ask user, check other branches
- **Outcome**: Package manifest or workflow end

### 2. Plan Availability
- **Decision**: No plan exists
- **Options**: Ask user for plan, user cancels
- **Outcome**: Load plan or graceful exit

### 3. MECE Compliance
- **Decision**: MECE violation detected
- **Options**: Create new packages, handle deprecation cycle
- **Outcome**: Expanded suite with additional packages

### 4. Quality Score
- **Decision**: Score below 85%
- **Options**: Remediation agent (attempts < 3), skip publishing
- **Outcome**: Fixed quality or skipped package

### 5. Publishing
- **Decision**: Quality passed
- **Options**: Publish based on score level
- **Outcome**: Package published to npm

## Activity Distribution

### Discovery Activities (7)
1. parseInput
2. searchForPackage
3. readPackageJson
4. buildDependencyTree
5. checkNpmStatus
6. setupWorktree
7. copyEnvFiles

### Planning Activities (4)
1. searchLocalPlans
2. queryMcpForPlan
3. validatePlan
4. registerPlanWithMcp

### MECE Activities (5)
1. analyzeMeceCompliance
2. generateSplitPlans
3. registerSplitPlans
4. determineDeprecationCycle
5. updateDependentPlans

### Build Activities (1)
1. runBuild

### Quality Activities (9)
1. validatePackageStructure
2. runTypeScriptCheck
3. runLintCheck
4. runTestsWithCoverage
5. runSecurityAudit
6. validateDocumentation
7. validateLicenseHeaders
8. validateIntegrationPoints
9. calculateComplianceScore

### Remediation Activities (1)
1. runRemediationAgent

### Publish Activities (4)
1. determineVersionBump
2. publishToNpm
3. updateDependentVersions
4. publishDeprecationNotice

### Report Activities (2)
1. loadAllPackageReports
2. writeSuiteReport

**Total New Activities: 33**

## Workflow Execution Timeline Example

```
Time 0:00 - User runs: yarn workflow:run openai-client
Time 0:01 - Discovery: Find package, build dep tree (logger, retry-policy, neverhub-adapter)
Time 0:05 - Planning: Validate plans for 4 packages
Time 0:10 - MECE: Check compliance (no violations)
Time 0:15 - Build: Spawn 4 child workflows
  ├─ neverhub-adapter (no deps) - starts immediately
  ├─ retry-policy (no deps) - starts immediately
  └─ Wait for deps...
Time 0:20 - neverhub-adapter completes
Time 0:22 - logger starts (dep ready)
Time 0:25 - retry-policy completes
Time 0:30 - logger completes
Time 0:32 - openai-client starts (deps ready)
Time 0:35 - Quality checks run (all packages)
Time 0:36 - openai-client: coverage 78% (below 90% for core)
Time 0:37 - Remediation agent spawned for openai-client
Time 0:45 - Agent adds tests, re-run quality
Time 0:47 - openai-client: coverage 92% (passed!)
Time 0:50 - Publish: All 4 packages published
Time 0:55 - Complete: Suite report generated
```
