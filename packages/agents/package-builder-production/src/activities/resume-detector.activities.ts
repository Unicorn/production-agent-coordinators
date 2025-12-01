/**
 * Resume Detection Activities
 * 
 * Detects where a package build should resume by comparing current state
 * against the plan. Generates resume context for CLI agents.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { auditPackageState, type PackageAuditResult } from './build.activities.js';
import type { PackageAuditContext } from '../types/index.js';

/**
 * Resume point detection result
 */
export interface ResumePoint {
  /** Which phase to resume from */
  phase: 'scaffold' | 'implement' | 'test' | 'complete';
  /** Completion percentage (0-100) */
  completionPercentage: number;
  /** Files that already exist */
  existingFiles: string[];
  /** Files that need to be created */
  missingFiles: string[];
  /** Next steps to complete */
  nextSteps: string[];
  /** Resume instruction for CLI agent */
  resumeInstruction: string;
  /** Context to pass to CLI agent */
  resumeContext: PackageAuditContext;
}

/**
 * Detect where to resume a package build
 * 
 * Compares current file state against plan requirements to determine:
 * - Which phase to resume from
 * - What files exist vs missing
 * - What instructions to give the CLI agent
 */
export async function detectResumePoint(input: {
  workspaceRoot: string;
  packagePath: string;
  planPath: string;
}): Promise<ResumePoint> {
  console.log(`[ResumeDetector] Detecting resume point for ${input.packagePath}`);
  
  // Use existing audit functionality
  const audit = await auditPackageState({
    workspaceRoot: input.workspaceRoot,
    packagePath: input.packagePath,
    planPath: input.planPath,
  });
  
  // Parse findings into existing/missing files
  const existingFiles = audit.findings
    .filter(f => f.startsWith('✅'))
    .map(f => f.replace('✅ ', '').replace(' exists', '').trim());
  
  const missingFiles = audit.findings
    .filter(f => f.startsWith('❌'))
    .map(f => f.replace('❌ ', '').replace(' missing', '').trim());
  
  // Determine phase based on completion
  let phase: ResumePoint['phase'];
  if (audit.status === 'complete') {
    phase = 'complete';
  } else if (audit.completionPercentage < 30) {
    // Less than 30% complete - need scaffolding
    phase = 'scaffold';
  } else if (audit.completionPercentage < 80) {
    // 30-80% complete - need implementation
    phase = 'implement';
  } else {
    // 80%+ complete - likely just need tests/fixes
    phase = 'test';
  }
  
  // Build resume context
  const resumeContext: PackageAuditContext = {
    completionPercentage: audit.completionPercentage,
    existingFiles,
    missingFiles,
    nextSteps: audit.nextSteps || [],
    status: audit.status === 'complete' ? 'complete' : 'incomplete',
  };
  
  // Generate resume instruction based on phase
  const resumeInstruction = buildResumeInstruction(phase, audit, existingFiles, missingFiles);
  
  return {
    phase,
    completionPercentage: audit.completionPercentage,
    existingFiles,
    missingFiles,
    nextSteps: audit.nextSteps || [],
    resumeInstruction,
    resumeContext,
  };
}

/**
 * Build resume instruction for CLI agent based on phase and audit results
 */
function buildResumeInstruction(
  phase: ResumePoint['phase'],
  audit: PackageAuditResult,
  existingFiles: string[],
  missingFiles: string[]
): string {
  if (phase === 'complete') {
    return 'Package appears complete. Proceed to build and test verification.';
  }
  
  if (phase === 'scaffold') {
    return `Package is ${audit.completionPercentage}% complete. Start with scaffolding:

Create the basic package structure:
${missingFiles.map(f => `- ${f}`).join('\n')}

Focus on creating configuration files and directory structure first.`;
  }
  
  if (phase === 'implement') {
    return `Package is ${audit.completionPercentage}% complete. Continue implementation:

### Existing Files (DO NOT REGENERATE):
${existingFiles.length > 0 ? existingFiles.map(f => `- ${f}`).join('\n') : '- None'}

### Missing Components (TO BE CREATED):
${missingFiles.length > 0 ? missingFiles.map(f => `- ${f}`).join('\n') : '- None'}

### Next Steps:
${audit.nextSteps.map(s => `- ${s}`).join('\n')}

IMPORTANT: Focus ONLY on missing components. Do not regenerate existing files unless they have errors.`;
  }
  
  // phase === 'test'
  return `Package is ${audit.completionPercentage}% complete. Finalize and test:

### Remaining Tasks:
${audit.nextSteps.map(s => `- ${s}`).join('\n')}

Focus on:
- Completing any missing test files
- Fixing any build/lint errors
- Ensuring all requirements are met`;
}

/**
 * Check if package can be resumed (has partial implementation)
 */
export async function canResumePackage(input: {
  workspaceRoot: string;
  packagePath: string;
}): Promise<boolean> {
  const fullPath = path.join(input.workspaceRoot, input.packagePath);
  
  try {
    // Check if package directory exists
    await fs.access(fullPath);
    
    // Check if there's any code (package.json or src/)
    const pkgJsonPath = path.join(fullPath, 'package.json');
    const srcPath = path.join(fullPath, 'src');
    
    const hasPkgJson = await fs.access(pkgJsonPath).then(() => true).catch(() => false);
    const hasSrc = await fs.access(srcPath).then(() => true).catch(() => false);
    
    return hasPkgJson || hasSrc;
  } catch {
    return false;
  }
}

/**
 * Get resume context for CLI agent
 * 
 * This is a convenience function that combines detectResumePoint
 * with context formatting for CLI agents.
 */
export async function getResumeContext(input: {
  workspaceRoot: string;
  packagePath: string;
  planPath: string;
}): Promise<{
  shouldResume: boolean;
  resumePoint?: ResumePoint;
  instruction?: string;
}> {
  const canResume = await canResumePackage({
    workspaceRoot: input.workspaceRoot,
    packagePath: input.packagePath,
  });
  
  if (!canResume) {
    return { shouldResume: false };
  }
  
  const resumePoint = await detectResumePoint(input);
  
  return {
    shouldResume: true,
    resumePoint,
    instruction: resumePoint.resumeInstruction,
  };
}

