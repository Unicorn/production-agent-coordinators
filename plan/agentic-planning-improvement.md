# Agentic Planning Improvement - Package Comparison & User Interaction

## Overview

Improve the SuiteBuilderWorkflow planning phase to intelligently handle missing plans through:
1. **Package Similarity Research**: Find similar existing packages to use as reference templates
2. **Agentic Plan Generation**: Use AI agents to generate plans based on similar packages
3. **User Interaction Fallback**: If no good reference exists, engage user in conversation to gather requirements

## Current Behavior (Problem)

When `packages_get` returns no plan for a package:
```typescript
// Current: Hard failure
if (!planResult || planResult.status === 'not_found') {
  throw new Error(`No plan found for ${packageName}. Please create a plan first.`);
}
```

**Issues:**
- Workflow fails immediately
- No attempt to generate a plan automatically
- No user interaction to gather requirements
- Wastes the discovery work already completed

## Desired Behavior (Solution)

```typescript
// Improved: Multi-stage intelligent planning
if (!planResult || planResult.status === 'not_found') {
  // Stage 1: Search for similar packages
  const similarPackages = await searchSimilarPackages(packageName);

  if (similarPackages.length > 0) {
    // Stage 2: Generate plan using similar package as reference
    const generatedPlan = await generatePlanFromReference(packageName, similarPackages[0]);
    return generatedPlan;
  } else {
    // Stage 3: Engage user to gather requirements
    const userRequirements = await promptUserForRequirements(packageName);
    const generatedPlan = await generatePlanFromUserInput(packageName, userRequirements);
    return generatedPlan;
  }
}
```

## Architecture

### 1. Package Similarity Research Activity

**File**: `src/activities/planning.activities.ts`

**New Activity**: `searchSimilarPackages`

```typescript
export interface SimilarPackageResult {
  packageName: string;
  similarity: number; // 0-100
  reason: string;
  hasPlan: boolean;
  planSummary?: string;
}

export async function searchSimilarPackages(input: {
  packageName: string;
  workspaceRoot: string;
}): Promise<SimilarPackageResult[]> {
  // Step 1: Query MCP packages API for all packages
  const allPackages = await mcpPackagesQuery({
    filters: { status: ['completed', 'in_progress'] },
    limit: 100
  });

  // Step 2: Calculate similarity scores
  const similarities: SimilarPackageResult[] = [];

  for (const pkg of allPackages) {
    const score = calculateSimilarity(input.packageName, pkg.name);

    if (score > 30) { // Threshold for relevance
      similarities.push({
        packageName: pkg.name,
        similarity: score,
        reason: explainSimilarity(input.packageName, pkg.name),
        hasPlan: pkg.plan_content !== null,
        planSummary: pkg.summary
      });
    }
  }

  // Step 3: Sort by similarity and plan availability
  return similarities
    .sort((a, b) => {
      // Prioritize packages with plans
      if (a.hasPlan !== b.hasPlan) return a.hasPlan ? -1 : 1;
      return b.similarity - a.similarity;
    })
    .slice(0, 5); // Top 5 matches
}

function calculateSimilarity(target: string, candidate: string): number {
  // Similarity factors:
  // 1. Name similarity (Levenshtein distance)
  // 2. Category match (client, service, suite, ui)
  // 3. Technology match (openai/anthropic both AI clients)
  // 4. Scope match (core, services, suites, ui)

  let score = 0;

  // Extract category from name
  const targetCategory = extractCategory(target); // "client", "service", etc.
  const candidateCategory = extractCategory(candidate);

  if (targetCategory === candidateCategory) score += 40;

  // Check for similar technology/domain
  const targetDomain = extractDomain(target); // "openai", "anthropic", etc.
  const candidateDomain = extractDomain(candidate);

  if (areSimilarDomains(targetDomain, candidateDomain)) score += 30;

  // String similarity for remaining score
  const stringSimilarity = calculateLevenshtein(target, candidate);
  score += stringSimilarity * 30;

  return Math.min(score, 100);
}

function extractCategory(packageName: string): string {
  // openai-client -> client
  // user-service -> service
  // content-suite -> suite
  if (packageName.includes('client')) return 'client';
  if (packageName.includes('service')) return 'service';
  if (packageName.includes('suite')) return 'suite';
  if (packageName.includes('ui')) return 'ui';
  return 'unknown';
}

function extractDomain(packageName: string): string {
  // openai-client -> openai
  // anthropic-client -> anthropic
  return packageName.split('-')[0];
}

function areSimilarDomains(domain1: string, domain2: string): boolean {
  // AI clients: openai, anthropic, claude, gemini
  const aiClients = ['openai', 'anthropic', 'claude', 'gemini', 'cohere'];
  if (aiClients.includes(domain1) && aiClients.includes(domain2)) return true;

  // Database clients: postgres, mysql, mongo
  const dbClients = ['postgres', 'mysql', 'mongo', 'redis'];
  if (dbClients.includes(domain1) && dbClients.includes(domain2)) return true;

  return false;
}

function explainSimilarity(target: string, candidate: string): string {
  const targetCat = extractCategory(target);
  const candidateCat = extractCategory(candidate);
  const targetDom = extractDomain(target);
  const candidateDom = extractDomain(candidate);

  const reasons: string[] = [];

  if (targetCat === candidateCat) {
    reasons.push(`Both are ${targetCat} packages`);
  }

  if (areSimilarDomains(targetDom, candidateDom)) {
    reasons.push(`Similar domains (${targetDom} and ${candidateDom})`);
  }

  return reasons.join('; ');
}
```

### 2. Agentic Plan Generation Activity

**File**: `src/activities/planning.activities.ts`

**New Activity**: `generatePlanFromReference`

```typescript
export async function generatePlanFromReference(input: {
  packageName: string;
  referencePackage: string;
  workspaceRoot: string;
}): Promise<string> {
  // Step 1: Get reference package plan
  const referencePlan = await mcpPackagesGet({
    id: input.referencePackage,
    include: ['plan_content']
  });

  if (!referencePlan.plan_content) {
    throw new Error(`Reference package ${input.referencePackage} has no plan`);
  }

  // Step 2: Invoke Claude to adapt plan
  const prompt = `
You are a package planning expert. Generate a detailed implementation plan for a new package based on a reference package plan.

# Task
Create a plan for: ${input.packageName}
Using this reference: ${input.referencePackage}

# Reference Plan
${referencePlan.plan_content}

# Instructions
1. Maintain the same structure and quality standards
2. Adapt implementation details for ${input.packageName}
3. Keep the same testing, documentation, and quality requirements
4. Update package-specific details (names, dependencies, APIs)
5. Ensure MECE compliance (Mutually Exclusive, Collectively Exhaustive)

# Output
Generate the complete markdown plan following the same format as the reference.
`;

  const response = await callClaude(prompt);

  // Step 3: Save generated plan to file system
  const planPath = path.join(input.workspaceRoot, 'plan', `${input.packageName}.md`);
  await fs.promises.mkdir(path.dirname(planPath), { recursive: true });
  await fs.promises.writeFile(planPath, response, 'utf-8');

  return planPath;
}

async function callClaude(prompt: string): Promise<string> {
  // Use Anthropic SDK or HTTP API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  const data = await response.json();
  return data.content[0].text;
}
```

### 3. User Interaction Activity

**File**: `src/activities/planning.activities.ts`

**New Activity**: `promptUserForRequirements`

```typescript
export interface UserRequirements {
  packageDescription: string;
  keyFeatures: string[];
  dependencies: string[];
  integrations: string[];
  testingRequirements: string;
  additionalNotes: string;
}

export async function promptUserForRequirements(input: {
  packageName: string;
}): Promise<UserRequirements> {
  // This activity will send a signal to Temporal workflow
  // to wait for user input via a query or signal

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 PLAN NEEDED: ${input.packageName}`);
  console.log(${'='.repeat(60)}`);
  console.log('No similar packages found to use as reference.');
  console.log('Please provide requirements to generate a plan:\n');

  // In a real implementation, this would:
  // 1. Send notification to user (email, slack, etc.)
  // 2. Present web form or CLI prompt
  // 3. Wait for user input via Temporal signal

  // For now, throw error with instructions
  throw new Error(`
Please create a plan file for ${input.packageName}.

You can:
1. Create plan manually at: plan/${input.packageName}.md
2. Use the package-planning-writer agent
3. Provide requirements via: temporal workflow signal <workflow-id> --name=userRequirements

Required information:
- Package description and purpose
- Key features to implement
- Dependencies and integrations
- Testing requirements
- Any additional notes or constraints
  `);
}
```

### 4. Workflow Updates

**File**: `src/workflows/suite-builder.workflow.ts`

**Modified**: `planningPhase` function

```typescript
async function planningPhase(
  packageName: string,
  planFilePath: string | null,
  workspaceRoot: string
): Promise<string> {
  console.log(`[SuiteBuilderWorkflow(${workflowInfo().workflowId})] Phase 2: PLANNING`);

  // Try 1: Check for local plan file
  if (planFilePath) {
    console.log(`[SuiteBuilderWorkflow(${workflowInfo().workflowId})]   Using provided plan: ${planFilePath}`);
    return planFilePath;
  }

  // Try 2: Query MCP for existing plan
  console.log(`[SuiteBuilderWorkflow(${workflowInfo().workflowId})]   No local plan found, querying MCP...`);

  const planResult = await getPackagePlan({ packageName });

  if (planResult && planResult.status === 'found') {
    console.log(`[SuiteBuilderWorkflow(${workflowInfo().workflowId})]   ✓ Found plan via MCP`);
    return planResult.planPath;
  }

  // Try 3: Search for similar packages
  console.log(`[SuiteBuilderWorkflow(${workflowInfo().workflowId})]   No plan found, searching for similar packages...`);

  const similarPackages = await searchSimilarPackages({ packageName, workspaceRoot });

  if (similarPackages.length > 0 && similarPackages[0].hasPlan) {
    const reference = similarPackages[0];
    console.log(`[SuiteBuilderWorkflow(${workflowInfo().workflowId})]   ✓ Found similar package: ${reference.packageName} (${reference.similarity}% match)`);
    console.log(`[SuiteBuilderWorkflow(${workflowInfo().workflowId})]   Reason: ${reference.reason}`);
    console.log(`[SuiteBuilderWorkflow(${workflowInfo().workflowId})]   Generating plan from reference...`);

    const generatedPlanPath = await generatePlanFromReference({
      packageName,
      referencePackage: reference.packageName,
      workspaceRoot
    });

    console.log(`[SuiteBuilderWorkflow(${workflowInfo().workflowId})]   ✓ Plan generated: ${generatedPlanPath}`);
    return generatedPlanPath;
  }

  // Try 4: Request user input
  console.log(`[SuiteBuilderWorkflow(${workflowInfo().workflowId})]   No similar packages found`);
  console.log(`[SuiteBuilderWorkflow(${workflowInfo().workflowId})]   Requesting user requirements...`);

  await promptUserForRequirements({ packageName });

  // If we reach here, workflow will wait for signal with requirements
  // Then generate plan from user input
  throw new Error(`Workflow paused awaiting user input for ${packageName} requirements`);
}
```

## Implementation Steps

### Phase 1: Package Similarity Research (Priority: High)
- [ ] Implement `searchSimilarPackages` activity
  - [ ] Add to `src/activities/planning.activities.ts`
  - [ ] Write similarity calculation functions
  - [ ] Add category and domain extraction
  - [ ] Implement explanation generator
- [ ] Write tests for similarity algorithm
  - [ ] Test openai-client -> anthropic-client (should be high)
  - [ ] Test openai-client -> user-service (should be low)
  - [ ] Test edge cases
- [ ] Update workflow to call `searchSimilarPackages`

### Phase 2: Agentic Plan Generation (Priority: High)
- [ ] Implement `generatePlanFromReference` activity
  - [ ] Add Claude API integration
  - [ ] Create prompt template
  - [ ] Add plan file writing
- [ ] Add environment variable for ANTHROPIC_API_KEY
- [ ] Write tests with mock Claude responses
- [ ] Update workflow to call `generatePlanFromReference`

### Phase 3: User Interaction (Priority: Medium)
- [ ] Design user requirements schema
- [ ] Implement `promptUserForRequirements` activity
- [ ] Add Temporal signal handler for user input
- [ ] Create `generatePlanFromUserInput` activity
- [ ] Build CLI prompt interface
- [ ] Build web form interface (optional)

### Phase 4: Integration & Testing (Priority: High)
- [ ] Update `planningPhase` with new flow
- [ ] Add workflow tests for all 4 strategies
- [ ] Test end-to-end with real packages
- [ ] Document new planning workflow
- [ ] Update error messages and user guidance

## Success Criteria

1. **Automatic Plan Generation**: When requesting `openai-client` and `anthropic-client` plan exists, should automatically generate plan
2. **Similarity Accuracy**: Similar packages (same category/domain) score >70%
3. **User Experience**: Clear error messages guiding users on next steps
4. **No Breaking Changes**: Existing workflows with plans continue to work
5. **Test Coverage**: >90% coverage for new planning activities

## Example Scenarios

### Scenario 1: Similar Package Exists
```
Input: openai-client (no plan)
Step 1: Search similar packages
  → Found: anthropic-client (85% similarity, has plan)
Step 2: Generate plan from reference
  → Using anthropic-client plan as template
  → Adapted for openai-client
  → Saved to plan/openai-client.md
Step 3: Continue workflow with generated plan
```

### Scenario 2: No Similar Package
```
Input: novel-package (no plan, no similar packages)
Step 1: Search similar packages
  → No packages found with >30% similarity
Step 2: Prompt user for requirements
  → Display instructions
  → Wait for user signal with requirements
Step 3: Generate plan from user input
  → Create plan based on user requirements
  → Saved to plan/novel-package.md
Step 4: Continue workflow with generated plan
```

### Scenario 3: Plan Already Exists
```
Input: anthropic-client (has plan)
Step 1: Query MCP
  → Found existing plan
Step 2: Use existing plan
  → Skip similarity search
  → Skip plan generation
Step 3: Continue workflow immediately
```

## Dependencies

- **Required**:
  - Anthropic API key for Claude integration
  - MCP packages API access
  - File system access for plan writing

- **Optional**:
  - Slack/Email integration for user notifications
  - Web UI for requirements gathering

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Claude API failure | High - Cannot generate plans | Add retry logic, fallback to template, cache responses |
| Bad similarity matches | Medium - Wrong reference used | Manual review step, confidence threshold, user confirmation |
| User doesn't respond | Medium - Workflow stuck | Timeout with clear instructions, async signal handling |
| Generated plan quality | High - Bad package built | Validation step, MECE check, user review before build |

## Future Enhancements

1. **Machine Learning**: Train ML model on existing plans for better similarity
2. **Plan Templates**: Create templates for common package types
3. **Interactive Mode**: Real-time chat with user to refine requirements
4. **Versioning**: Track plan generations and allow rollback
5. **Batch Mode**: Generate multiple plans at once
6. **Plan Review**: AI agent reviews generated plan before use
