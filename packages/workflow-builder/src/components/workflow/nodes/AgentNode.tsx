/**
 * Agent Node - Custom node for AI agents
 */

import { memo } from 'react';
import { Handle, Position } from 'react-flow-renderer';

interface AgentNodeProps {
  data: {
    label: string;
    componentName?: string;
  };
  selected?: boolean;
}

export const AgentNode = memo(({ data, selected }: AgentNodeProps) => {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: selected ? '#a855f7' : '#faf5ff',
        border: `2px solid ${selected ? '#a855f7' : '#e9d5ff'}`,
        minWidth: '180px',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div>
        <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>
          Agent
        </div>
        <div style={{ fontSize: '14px', fontWeight: '600', color: selected ? 'white' : '#1f2937', marginTop: '4px' }}>
          {data.label}
        </div>
        {data.componentName && (
          <div style={{ fontSize: '12px', color: selected ? '#f3e8ff' : '#6b7280', marginTop: '2px', fontFamily: 'monospace' }}>
            {data.componentName}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});

AgentNode.displayName = 'AgentNode';

