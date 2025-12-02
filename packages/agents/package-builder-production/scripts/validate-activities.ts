#!/usr/bin/env tsx
/**
 * Activity Validation Script
 * 
 * Validates that all activities used in workflows are exported from activities/index.ts
 * and registered in the worker.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

interface ActivityUsage {
  activityName: string;
  workflowFile: string;
  lineNumber: number;
}

async function findActivityUsages(): Promise<ActivityUsage[]> {
  const workflowsDir = path.join(projectRoot, 'src', 'workflows');
  const files = await fs.readdir(workflowsDir, { recursive: true });
  
  const usages: ActivityUsage[] = [];
  
  for (const file of files) {
    if (!file.endsWith('.ts') || file.includes('archived') || file.includes('__tests__')) {
      continue;
    }
    
    const filePath = path.join(workflowsDir, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Find proxyActivities calls
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match: const { activity1, activity2, ... } = proxyActivities<...>({...});
      // Handle multi-line destructuring
      if (line.includes('proxyActivities')) {
        // Collect all lines until we find the closing brace and semicolon
        let currentLine = i;
        let fullBlock = '';
        let braceCount = 0;
        let foundOpening = false;
        let parenCount = 0;
        let foundParen = false;
        
        // Find the start of this proxyActivities call
        while (currentLine < lines.length) {
          const currentLineContent = lines[currentLine];
          
          // Count braces to find the destructuring block
          for (const char of currentLineContent) {
            if (char === '{') {
              braceCount++;
              foundOpening = true;
            } else if (char === '}') {
              braceCount--;
            }
            if (char === '(' && foundOpening && braceCount === 0) {
              parenCount++;
              foundParen = true;
            } else if (char === ')' && foundParen) {
              parenCount--;
            }
          }
          
          fullBlock += currentLineContent + '\n';
          
          // If we found opening brace, closed it, found parens, and closed them, we're done
          if (foundOpening && braceCount === 0 && foundParen && parenCount === 0 && currentLineContent.includes(';')) {
            break;
          }
          
          currentLine++;
          if (currentLine - i > 20) break; // Safety limit
        }
        
        // Extract the destructured names - handle multi-line with proper brace matching
        // Find the opening brace, then find the matching closing brace
        const braceStart = fullBlock.indexOf('{');
        if (braceStart === -1) continue;
        
        let braceDepth = 0;
        let braceEnd = -1;
        for (let j = braceStart; j < fullBlock.length; j++) {
          if (fullBlock[j] === '{') braceDepth++;
          if (fullBlock[j] === '}') {
            braceDepth--;
            if (braceDepth === 0) {
              braceEnd = j;
              break;
            }
          }
        }
        
        if (braceEnd === -1) continue;
        
        // Extract content between braces
        const activitiesStr = fullBlock.substring(braceStart + 1, braceEnd);
        
        // Split by comma, but handle newlines properly
        // Filter out Temporal workflow functions (not activities)
        const temporalWorkflowFunctions = new Set([
          'condition', 'defineSignal', 'startChild', 'executeChild', 'sleep', 'waitCondition',
          'startToCloseTimeout', 'scheduleToCloseTimeout', 'heartbeatTimeout', 'retry'
        ]);
        
        const allActivities = activitiesStr
          .split(/[,\n]/)
          .map(a => {
            // Remove comments, whitespace, handle renaming (old: new)
            return a
              .trim()
              .split('//')[0] // Remove inline comments
              .trim()
              .split(':')[0] // Handle destructuring with renaming
              .trim();
          })
          .filter(a => {
            return a && 
                   !a.includes('typeof') && 
                   !a.includes('import') && 
                   a.length > 0 && 
                   !a.includes('proxyActivities') &&
                   !temporalWorkflowFunctions.has(a);
          });
        
        for (const activity of allActivities) {
          if (activity) {
            usages.push({
              activityName: activity,
              workflowFile: file,
              lineNumber: i + 1,
            });
          }
        }
      }
    }
  }
  
  return usages;
}

async function getExportedActivities(): Promise<Set<string>> {
  const activitiesIndex = path.join(projectRoot, 'src', 'activities', 'index.ts');
  const content = await fs.readFile(activitiesIndex, 'utf-8');
  
  // Extract from ALL_ACTIVITY_NAMES array
  const activityNamesMatch = content.match(/export const ALL_ACTIVITY_NAMES = \[([\s\S]*?)\]/);
  if (!activityNamesMatch) {
    throw new Error('Could not find ALL_ACTIVITY_NAMES in activities/index.ts');
  }
  
  const activityNamesStr = activityNamesMatch[1];
  const exported = new Set<string>();
  
  // Extract quoted activity names
  const matches = activityNamesStr.matchAll(/'([^']+)'/g);
  for (const match of matches) {
    exported.add(match[1]);
  }
  
  return exported;
}

async function getActualExports(): Promise<Set<string>> {
  // Read all activity files to get actual function exports
  const activitiesDir = path.join(projectRoot, 'src', 'activities');
  const files = await fs.readdir(activitiesDir);
  
  const exports = new Set<string>();
  
  for (const file of files) {
    if (!file.endsWith('.ts') || file === 'index.ts' || file.includes('__tests__')) {
      continue;
    }
    
    const filePath = path.join(activitiesDir, file);
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Find exported functions: export async function name(...) or export function name(...)
    const functionMatches = content.matchAll(/export\s+(async\s+)?function\s+(\w+)/g);
    for (const match of functionMatches) {
      exports.add(match[2]);
    }
  }
  
  return exports;
}

async function main() {
  console.log('🔍 Validating activity exports...\n');
  
  const [usages, exportedNames, actualExports] = await Promise.all([
    findActivityUsages(),
    getExportedActivities(),
    getActualExports(),
  ]);
  
  // Get unique activity names from workflows
  const usedActivities = new Set(usages.map(u => u.activityName));
  
  console.log(`📊 Found ${usages.length} activity usages across ${new Set(usages.map(u => u.workflowFile)).size} workflow files`);
  console.log(`📦 Found ${exportedNames.size} activities in ALL_ACTIVITY_NAMES`);
  console.log(`🔧 Found ${actualExports.size} actual exported functions\n`);
  
  // Check for missing exports
  const missing: string[] = [];
  const missingFromList: string[] = [];
  
  for (const activity of usedActivities) {
    if (!actualExports.has(activity)) {
      missing.push(activity);
    }
    if (!exportedNames.has(activity)) {
      missingFromList.push(activity);
    }
  }
  
  // Check for unused exports (warnings)
  const unused: string[] = [];
  for (const exported of exportedNames) {
    if (!usedActivities.has(exported)) {
      unused.push(exported);
    }
  }
  
  // Show used activities for verification
  console.log('📋 Activities used in workflows:');
  const sortedUsed = Array.from(usedActivities).sort();
  for (const activity of sortedUsed) {
    const usage = usages.find(u => u.activityName === activity);
    const isExported = actualExports.has(activity);
    const inList = exportedNames.has(activity);
    const status = isExported && inList ? '✅' : isExported ? '⚠️' : '❌';
    console.log(`   ${status} ${activity} (${usage?.workflowFile})`);
  }
  console.log('');
  
  // Report results
  if (missing.length > 0) {
    console.log('❌ MISSING EXPORTS (activities used but not exported):');
    for (const activity of missing) {
      const usage = usages.find(u => u.activityName === activity);
      console.log(`   - ${activity} (used in ${usage?.workflowFile}:${usage?.lineNumber})`);
    }
    console.log('');
  }
  
  if (missingFromList.length > 0) {
    console.log('⚠️  MISSING FROM ALL_ACTIVITY_NAMES (exported but not in list):');
    for (const activity of missingFromList) {
      const usage = usages.find(u => u.activityName === activity);
      console.log(`   - ${activity} (used in ${usage?.workflowFile}:${usage?.lineNumber})`);
    }
    console.log('');
  }
  
  if (unused.length > 0) {
    console.log('ℹ️  UNUSED EXPORTS (in ALL_ACTIVITY_NAMES but not used in workflows):');
    console.log(`   ${unused.length} activities (this is OK - they may be used elsewhere)`);
    console.log('');
  }
  
  if (missing.length === 0 && missingFromList.length === 0) {
    console.log('✅ All activities are properly exported and registered!');
    process.exit(0);
  } else {
    console.log('❌ Validation failed - see issues above');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

