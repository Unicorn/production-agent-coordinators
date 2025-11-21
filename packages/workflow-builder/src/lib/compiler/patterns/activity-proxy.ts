/**
 * Activity Proxy Pattern
 * Generates proxyActivities() code for activity and agent nodes
 */

import type { Pattern, WorkflowNode, GeneratorContext, CodeBlock } from '../types';
import { indent, toCamelCase } from '../utils/ast-helpers';

/**
 * Activity Proxy Pattern
 * Detects activity/agent nodes and generates proxyActivities code
 */
export const ActivityProxyPattern: Pattern = {
  name: 'activity-proxy',
  priority: 100, // High priority - needs to run early

  detect: (node: WorkflowNode, context: GeneratorContext): boolean => {
    return node.type === 'activity' || node.type === 'agent';
  },

  generate: (node: WorkflowNode, context: GeneratorContext): CodeBlock => {
    const activityName = node.data.activityName || node.data.componentName || toCamelCase(node.id);
    const timeout = node.data.timeout || '5 minutes';
    const config = node.data.config || {};

    // Generate result variable name
    const resultVar = `result_${node.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    context.resultVars.set(node.id, resultVar);

    // Build activity call
    const indentLevel = context.currentIndent;
    const indentStr = indent(indentLevel);

    // Check if this is the first activity - if so, generate proxy setup
    const activityNodes = context.nodes.filter(n => n.type === 'activity' || n.type === 'agent');
    const isFirstActivity = activityNodes[0]?.id === node.id;

    const code: string[] = [];
    const imports: string[] = [];
    const declarations: string[] = [];

    // Generate proxy setup for first activity
    if (isFirstActivity) {
      imports.push(`import { proxyActivities } from '@temporalio/workflow';`);
      imports.push(`import type * as activities from './activities';`);

      // Collect all activity names
      const allActivityNames = activityNodes.map(n =>
        n.data.activityName || n.data.componentName || toCamelCase(n.id)
      );

      declarations.push(
        `// Activity proxies\nconst { ${allActivityNames.join(', ')} } = proxyActivities<typeof activities>({\n` +
        `  startToCloseTimeout: '${timeout}',\n` +
        `  retry: {\n` +
        `    initialInterval: '1s',\n` +
        `    backoffCoefficient: 2,\n` +
        `    maximumAttempts: 3,\n` +
        `  },\n` +
        `});`
      );
    }

    // Generate activity invocation
    code.push(`${indentStr}// Execute ${node.type}: ${node.data.label || node.id}`);

    // Handle retry policy if specified on this node
    const retryPolicy = node.data.retryPolicy;
    if (retryPolicy && retryPolicy.strategy !== 'none') {
      code.push(`${indentStr}// Custom retry policy: ${retryPolicy.strategy}`);
    }

    // Build input parameter
    const inputParam = buildInputParameter(node, context);

    code.push(`${indentStr}const ${resultVar} = await ${activityName}(${inputParam});`);

    if (node.type === 'agent') {
      code.push(`${indentStr}// Agent response stored in ${resultVar}`);
    }

    return {
      code: code.join('\n'),
      imports,
      declarations,
      resultVar,
    };
  },

  dependencies: ['@temporalio/workflow', '@temporalio/activity'],
};

/**
 * Build input parameter for activity call
 */
function buildInputParameter(node: WorkflowNode, context: GeneratorContext): string {
  const config = node.data.config || {};

  // Check if there's explicit input mapping
  if (config.inputMapping && typeof config.inputMapping === 'object') {
    const mappings = Object.entries(config.inputMapping).map(([key, value]) => {
      // Check if value references a previous result
      const referencedVar = context.resultVars.get(value as string);
      if (referencedVar) {
        return `${key}: ${referencedVar}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    });

    return `{ ${mappings.join(', ')} }`;
  }

  // Check if there's a previous result to use
  const incomingEdges = context.edges.filter(e => e.target === node.id);
  if (incomingEdges.length > 0) {
    const sourceNodeId = incomingEdges[0].source;
    const sourceResult = context.resultVars.get(sourceNodeId);

    if (sourceResult) {
      return sourceResult;
    }
  }

  // Default to 'input'
  return 'input';
}

export default ActivityProxyPattern;
