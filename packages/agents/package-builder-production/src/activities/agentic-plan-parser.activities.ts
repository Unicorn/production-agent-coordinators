import * as path from 'path';
import * as fs from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import type { PackageNode, PackageCategory } from '../types/index.js';

/**
 * Agentic Plan Parser
 *
 * Uses Claude AI to intelligently parse plan files and extract package dependencies.
 * This approach is more flexible than regex parsing and can handle various plan formats.
 */

interface ParsedPlanData {
  packageName: string;
  dependencies: Array<{
    name: string;
    category: PackageCategory;
    description?: string;
  }>;
}

/**
 * Parse plan file using AI agent to extract package info and dependencies
 */
export async function parsePlanFileWithAgent(input: {
  workspaceRoot: string;
  planPath: string;
}): Promise<PackageNode[]> {
  const fullPath = path.join(input.workspaceRoot, input.planPath);
  const planContent = await fs.readFile(fullPath, 'utf-8');

  console.log(`[AgenticParser] Parsing plan with AI: ${input.planPath}`);

  // Derive category from plan file path (e.g., plans/packages/service/foo.md → service)
  const pathParts = input.planPath.split('/');
  const categoryFromPath = extractCategoryFromPath(pathParts);
  console.log(`[AgenticParser] Category from path: ${categoryFromPath}`);

  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Construct prompt for Claude
  const prompt = `You are a technical plan file parser. Analyze this package plan file and extract the main package information and ALL of its dependencies.

PLAN FILE CONTENT:
${planContent}

INSTRUCTIONS:
1. Identify the main package name (format: @scope/package-name)
2. Find ALL package dependencies mentioned in the plan, regardless of which section they appear in
   - Look in "Dependencies" sections
   - Look in "Package Hierarchy" sections
   - Look in any lists of packages with @ symbols
   - Include packages from subsections like "Core Packages", "Service Packages", "UI Packages", etc.
3. For each dependency, determine its category from its name:
   - If name contains "validator" → category: validator
   - If name contains "suite" → category: suite
   - If name contains "ui" or "component" → category: ui
   - If name contains "service" or "adapter" → category: service
   - If name contains "util" or "helper" → category: utility
   - Otherwise → category: core

IMPORTANT: Extract ALL packages mentioned in the plan, not just from a single section.

Return your response as valid JSON in this exact format:
{
  "packageName": "@scope/main-package",
  "dependencies": [
    {
      "name": "@scope/dependency-1",
      "category": "core",
      "description": "Optional brief description"
    }
  ]
}

Return ONLY the JSON object, no additional text or explanation.`;

  try {
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
    const maxTokens = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '8000', 10);

    const message = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract JSON from response
    let responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    console.log(`[AgenticParser] AI response length: ${responseText.length} chars`);

    // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
    responseText = responseText.trim();
    if (responseText.startsWith('```')) {
      // Remove opening ```json or ```
      responseText = responseText.replace(/^```(?:json)?\s*\n/, '');
      // Remove closing ```
      responseText = responseText.replace(/\n```\s*$/, '');
    }

    // Parse JSON response
    const parsedData: ParsedPlanData = JSON.parse(responseText.trim());

    console.log(`[AgenticParser] Extracted main package: ${parsedData.packageName}`);
    console.log(`[AgenticParser] Found ${parsedData.dependencies.length} dependencies`);

    // Build package nodes
    const packages: PackageNode[] = [];

    // Add dependencies as nodes first
    for (const dep of parsedData.dependencies) {
      const layer = categoryToLayer(dep.category);
      packages.push({
        name: dep.name,
        category: dep.category,
        dependencies: [], // Dependencies don't have their own dependencies in this context
        layer,
        buildStatus: 'pending',
      });
    }

    // Add main package (use category from path, not AI)
    const mainLayer = categoryToLayer(categoryFromPath);
    packages.push({
      name: parsedData.packageName,
      category: categoryFromPath,
      dependencies: parsedData.dependencies.map(d => d.name),
      layer: mainLayer,
      buildStatus: 'pending',
    });

    // Sort by layer (validators first, suites last)
    packages.sort((a, b) => a.layer - b.layer);

    console.log(`[AgenticParser] Built ${packages.length} package nodes`);
    console.log(`[AgenticParser] Package layers: ${packages.map(p => `${p.name}:L${p.layer}`).join(', ')}`);

    return packages;

  } catch (error) {
    console.error(`[AgenticParser] Failed to parse plan:`, error);

    // Fallback to regex-based parsing if AI fails
    console.log(`[AgenticParser] Falling back to regex parser`);
    return fallbackRegexParser(planContent, input.planPath, categoryFromPath);
  }
}

/**
 * Fallback regex-based parser (same as original parsePlanFile)
 */
function fallbackRegexParser(content: string, planPath: string, categoryFromPath: PackageCategory): PackageNode[] {
  console.log('[AgenticParser] Using fallback regex parser');

  // Extract package name
  let packageName = '';
  const packageMatch = content.match(/\*\*Package:\*\*\s+`([^`]+)`/);
  if (packageMatch) {
    packageName = packageMatch[1];
  }

  if (!packageName) {
    const headerMatch = content.match(/^#\s+(@[\w-]+\/[\w-]+)/m);
    if (headerMatch) {
      packageName = headerMatch[1];
    }
  }

  if (!packageName) {
    throw new Error(`Could not extract package name from plan file: ${planPath}`);
  }

  console.log(`[AgenticParser] Using category from path: ${categoryFromPath}`);

  // Extract dependencies
  const dependencies: string[] = [];
  const depsMatch = content.match(/## Dependencies\s+([\s\S]*?)(?=\n##|\n---|$)/);

  if (depsMatch) {
    const depsSection = depsMatch[1];
    const depRegex = /^\s*-\s+`(@[a-z0-9-]+\/[a-z0-9-]+)`/gm;
    let match;
    while ((match = depRegex.exec(depsSection)) !== null) {
      dependencies.push(match[1]);
    }
  }

  const packages: PackageNode[] = [];

  // Helper function
  const getCategory = (name: string): PackageCategory => {
    if (name.includes('suite')) return 'suite';
    if (name.includes('validator')) return 'validator';
    if (name.includes('core')) return 'core';
    if (name.includes('util')) return 'utility';
    if (name.includes('service')) return 'service';
    if (name.includes('ui')) return 'ui';
    return 'core';
  };

  // Add dependencies as nodes
  dependencies.forEach((dep) => {
    const depCategory = getCategory(dep);
    const layer = categoryToLayer(depCategory);
    packages.push({
      name: dep,
      category: depCategory,
      dependencies: [],
      layer,
      buildStatus: 'pending',
    });
  });

  // Add main package
  packages.push({
    name: packageName,
    category: categoryFromPath,
    dependencies,
    layer: categoryToLayer(categoryFromPath),
    buildStatus: 'pending',
  });

  // Sort by layer
  return packages.sort((a, b) => a.layer - b.layer);
}

/**
 * Extract category from plan file path
 * E.g., "plans/packages/service/foo.md" → "service"
 */
function extractCategoryFromPath(pathParts: string[]): PackageCategory {
  // Find the index of "packages" in the path
  const packagesIndex = pathParts.indexOf('packages');

  if (packagesIndex === -1 || packagesIndex === pathParts.length - 1) {
    throw new Error(`Invalid plan path structure: ${pathParts.join('/')}`);
  }

  // The category is the directory after "packages"
  const category = pathParts[packagesIndex + 1];

  // Map directory names to categories (validators → validator)
  if (category === 'validators') return 'validator';

  // Validate it's a known category
  const validCategories: PackageCategory[] = ['validator', 'core', 'utility', 'service', 'ui', 'suite'];
  if (!validCategories.includes(category as PackageCategory)) {
    throw new Error(`Unknown category "${category}" from path: ${pathParts.join('/')}`);
  }

  return category as PackageCategory;
}

function categoryToLayer(category: PackageCategory): number {
  const layerMap: Record<string, number> = {
    'validator': 0,
    'core': 1,
    'utility': 2,
    'service': 3,
    'ui': 4,
    'suite': 5,
  };
  return layerMap[category] || 3;
}
