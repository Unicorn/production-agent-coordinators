/**
 * Condition Node - Branching logic with true/false paths
 */

import { memo } from 'react';
import { Handle, Position } from 'react-flow-renderer';
import { GitBranch } from 'lucide-react';

interface ConditionNodeProps {
  data: {
    label: string;
    expression?: string;
    config?: {
      expression?: string;
      conditions?: Array<{
        variable: string;
        operator: string;
        value: any;
      }>;
      operator?: 'AND' | 'OR';
    };
  };
  selected?: boolean;
}

export const ConditionNode = memo(({ data, selected }: ConditionNodeProps) => {
  const expression = data.config?.expression || data.expression || 'condition';
  const isSimple = expression.length < 50;

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '8px',
        backgroundColor: selected ? '#f59e0b' : '#fef3c7',
        border: `2px solid ${selected ? '#f59e0b' : '#fcd34d'}`,
        minWidth: '180px',
        transform: 'rotate(45deg)',
        position: 'relative',
      }}
    >
      {/* Rotate content back */}
      <div style={{ transform: 'rotate(-45deg)' }}>
        <Handle
          type="target"
          position={Position.Top}
          style={{
            transform: 'rotate(-45deg)',
            top: '-8px',
          }}
        />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <GitBranch size={16} color={selected ? 'white' : '#92400e'} />
          <div style={{ fontSize: '10px', color: selected ? 'white' : '#92400e', textTransform: 'uppercase', fontWeight: '600' }}>
            Condition
          </div>
        </div>
        
        <div
          style={{
            fontSize: '12px',
            fontWeight: '600',
            color: selected ? 'white' : '#78350f',
            marginTop: '8px',
            textAlign: 'center',
            fontFamily: 'monospace',
            wordBreak: 'break-word',
          }}
        >
          {isSimple ? expression : `${expression.substring(0, 30)}...`}
        </div>
      </div>

      {/* True output (right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{
          transform: 'rotate(-45deg)',
          right: '-8px',
          backgroundColor: '#10b981',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '10px',
            color: '#10b981',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}
        >
          TRUE
        </div>
      </Handle>

      {/* False output (left) */}
      <Handle
        type="source"
        position={Position.Left}
        id="false"
        style={{
          transform: 'rotate(-45deg)',
          left: '-8px',
          backgroundColor: '#ef4444',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '10px',
            color: '#ef4444',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}
        >
          FALSE
        </div>
      </Handle>
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';

