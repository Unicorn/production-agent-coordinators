/**
 * Activity Node - Custom node for activities
 */

import { memo } from 'react';
import { Handle, Position } from 'react-flow-renderer';

interface ActivityNodeProps {
  data: {
    label: string;
    componentName?: string;
  };
  selected?: boolean;
}

export const ActivityNode = memo(({ data, selected }: ActivityNodeProps) => {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: selected ? '#3b82f6' : '#eff6ff',
        border: `2px solid ${selected ? '#3b82f6' : '#bfdbfe'}`,
        minWidth: '180px',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div>
        <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase' }}>
          Activity
        </div>
        <div style={{ fontSize: '14px', fontWeight: '600', color: selected ? 'white' : '#1f2937', marginTop: '4px' }}>
          {data.label}
        </div>
        {data.componentName && (
          <div style={{ fontSize: '12px', color: selected ? '#e0e7ff' : '#6b7280', marginTop: '2px', fontFamily: 'monospace' }}>
            {data.componentName}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});

ActivityNode.displayName = 'ActivityNode';

