/**
 * State Management Pattern
 * Generates state variable declarations and operations
 */

import type { Pattern, WorkflowNode, GeneratorContext, CodeBlock } from '../types';
import { indent, toCamelCase, formatValue } from '../utils/ast-helpers';

/**
 * State Management Pattern
 * Handles state-variable nodes
 */
export const StateManagementPattern: Pattern = {
  name: 'state-management',
  priority: 90,

  detect: (node: WorkflowNode, context: GeneratorContext): boolean => {
    return node.type === 'state-variable';
  },

  generate: (node: WorkflowNode, context: GeneratorContext): CodeBlock => {
    const config = node.data.config || {};
    const varName = config.name || toCamelCase(node.id);
    const operation = config.operation || 'set';

    const indentLevel = context.currentIndent;
    const indentStr = indent(indentLevel);

    const code: string[] = [];
    const declarations: string[] = [];

    // Generate declaration for first occurrence
    const stateVarNodes = context.nodes.filter(
      n => n.type === 'state-variable' && (n.data.config?.name === varName || toCamelCase(n.id) === varName)
    );
    const isFirstOccurrence = stateVarNodes[0]?.id === node.id;

    if (isFirstOccurrence) {
      const initialValue = config.initialValue !== undefined
        ? formatValue(config.initialValue)
        : getDefaultInitialValue(operation);

      declarations.push(`let ${varName} = ${initialValue};`);
    }

    // Generate operation
    code.push(`${indentStr}// State variable: ${varName}`);

    switch (operation) {
      case 'set':
        const value = config.value !== undefined ? formatValue(config.value) : 'null';
        code.push(`${indentStr}${varName} = ${value};`);
        break;

      case 'append':
        const appendValue = config.value !== undefined ? formatValue(config.value) : 'null';
        code.push(`${indentStr}${varName}.push(${appendValue});`);
        break;

      case 'increment':
        code.push(`${indentStr}${varName}++;`);
        break;

      case 'decrement':
        code.push(`${indentStr}${varName}--;`);
        break;

      case 'get':
        code.push(`${indentStr}// Current value: ${varName}`);
        break;

      default:
        code.push(`${indentStr}// Unknown operation: ${operation}`);
    }

    return {
      code: code.join('\n'),
      declarations,
      imports: [],
    };
  },
};

/**
 * Get default initial value based on operation type
 */
function getDefaultInitialValue(operation?: string): string {
  switch (operation) {
    case 'increment':
    case 'decrement':
      return '0';
    case 'append':
      return '[]';
    case 'set':
    default:
      return 'null';
  }
}

export default StateManagementPattern;
