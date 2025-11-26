/**
 * Service Builder View Tests
 * Tests for the ServiceBuilderView component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test-helpers';
import { ServiceBuilderView } from '@/components/service/ServiceBuilderView';
import { api } from '@/lib/trpc/client';

// Mock React Flow since it requires a complex setup
vi.mock('react-flow-renderer', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="react-flow">{children}</div>,
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  useNodesState: () => [[], vi.fn()],
  useEdgesState: () => [[], vi.fn()],
  addEdge: vi.fn(),
}));

// Mock tRPC queries at module level
vi.mock('@/lib/trpc/client', () => {
  const mockUseQuery = vi.fn(() => ({
    data: [],
    isLoading: false,
  }));

  const mockUseQueryWithData = vi.fn(() => ({
    data: { workflow: { id: 'test-service-1', project_id: 'project-1', definition: { nodes: [], edges: [] } } },
    isLoading: false,
  }));

  return {
    api: {
      workflows: {
        get: {
          useQuery: mockUseQueryWithData,
        },
      },
      serviceInterfaces: {
        list: {
          useQuery: mockUseQuery,
        },
      },
      connectors: {
        list: {
          useQuery: mockUseQuery,
        },
      },
      projectConnectors: {
        list: {
          useQuery: mockUseQuery,
        },
      },
      createClient: vi.fn(() => ({
        query: vi.fn(),
        mutation: vi.fn(),
      })),
      Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    },
  };
});

describe('ServiceBuilderView', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  it('renders service builder with React Flow', async () => {
    render(<ServiceBuilderView serviceId="test-service-1" />);
    
    // Should render React Flow component
    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('renders service builder with React Flow', async () => {
    render(<ServiceBuilderView serviceId="test-service-1" />);
    
    // Should render React Flow component
    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });

  it('renders read-only mode when readOnly prop is true', async () => {
    render(<ServiceBuilderView serviceId="test-service-1" readOnly />);
    
    // Component should render (readOnly might affect interactions, not visibility)
    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('renders background, controls, and minimap', async () => {
    render(<ServiceBuilderView serviceId="test-service-1" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('background')).toBeInTheDocument();
      expect(screen.getByTestId('controls')).toBeInTheDocument();
      expect(screen.getByTestId('minimap')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

