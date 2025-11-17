/**
 * Trigger Node - Custom node for workflow triggers
 */

import { memo } from 'react';
import { Handle, Position } from 'react-flow-renderer';

interface TriggerNodeProps {
  data: {
    label: string;
    componentName?: string;
  };
  selected?: boolean;
}

export const TriggerNode = memo(({ data, selected }: TriggerNodeProps) => {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: selected ? '#f97316' : '#fff7ed',
        border: `2px solid ${selected ? '#f97316' : '#fed7aa'}`,
        minWidth: '180px',
      }}
    >
      <div>
        <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>
          Trigger
        </div>
        <div style={{ fontSize: '14px', fontWeight: '600', color: selected ? 'white' : '#1f2937', marginTop: '4px' }}>
          {data.label}
        </div>
        {data.componentName && (
          <div style={{ fontSize: '12px', color: selected ? '#ffedd5' : '#6b7280', marginTop: '2px', fontFamily: 'monospace' }}>
            {data.componentName}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';

