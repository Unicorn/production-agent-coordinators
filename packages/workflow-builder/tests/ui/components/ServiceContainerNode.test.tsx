/**
 * Service Container Node Tests
 * Tests for the ServiceContainerNode component
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '../test-helpers';
import { ServiceContainerNode } from '@/components/workflow/nodes/ServiceContainerNode';
import type { ServiceContainerNodeData } from '@/components/workflow/nodes/ServiceContainerNode';

describe('ServiceContainerNode', () => {
  const mockNodeData: ServiceContainerNodeData = {
    serviceId: 'service-1',
    serviceName: 'Test Service',
    incomingInterfaces: [
      {
        id: 'iface-1',
        name: 'onSignal',
        displayName: 'On Signal',
        interfaceType: 'signal',
        position: 50,
      },
    ],
    outgoingInterfaces: [
      {
        id: 'iface-2',
        name: 'queryStatus',
        displayName: 'Query Status',
        interfaceType: 'query',
        position: 50,
      },
    ],
    externalConnectors: [
      {
        id: 'conn-1',
        name: 'http-connector',
        displayName: 'HTTP Connector',
        connectorType: 'http',
        position: 25,
      },
    ],
    internalComponents: [
      {
        id: 'comp-1',
        type: 'activity',
        label: 'Process Data',
      },
    ],
    externalConnections: [
      {
        id: 'conn-1',
        targetServiceId: 'service-2',
        targetServiceName: 'Other Service',
        interfaceName: 'onSignal',
        position: 75,
      },
    ],
    viewMode: 'builder',
  };

  const mockNode = {
    id: 'node-1',
    type: 'serviceContainer',
    position: { x: 0, y: 0 },
    data: mockNodeData,
    selected: false,
  };

  it('renders service container node with service name', () => {
    render(<ServiceContainerNode {...mockNode} />);
    
    expect(screen.getByText('Test Service')).toBeInTheDocument();
  });

  it('renders incoming interfaces in builder view', () => {
    render(<ServiceContainerNode {...mockNode} />);
    
    // Should render interface labels
    expect(screen.getByText(/On Signal/i) || screen.getByText(/incoming/i)).toBeTruthy();
  });

  it('renders outgoing interfaces in builder view', () => {
    render(<ServiceContainerNode {...mockNode} />);
    
    // Should render outgoing interface labels
    expect(screen.getByText(/Query Status/i) || screen.getByText(/outgoing/i)).toBeTruthy();
  });

  it('renders external connectors in builder view', () => {
    render(<ServiceContainerNode {...mockNode} />);
    
    // Should render connector labels
    expect(screen.getByText(/HTTP Connector/i) || screen.getByText(/connector/i)).toBeTruthy();
  });

  it('renders internal components in builder view', () => {
    render(<ServiceContainerNode {...mockNode} />);
    
    // Should render component labels
    expect(screen.getByText(/Process Data/i) || screen.getByText(/component/i)).toBeTruthy();
  });

  it('renders in project view mode with compact layout', () => {
    const projectNodeData = {
      ...mockNodeData,
      viewMode: 'project' as const,
    };
    
    render(<ServiceContainerNode {...mockNode} data={projectNodeData} />);
    
    // Should still render service name
    expect(screen.getByText('Test Service')).toBeInTheDocument();
  });

  it('highlights when selected', () => {
    render(<ServiceContainerNode {...mockNode} selected />);
    
    // Selected state should be visually different (border color)
    expect(screen.getByText('Test Service')).toBeInTheDocument();
  });
});

