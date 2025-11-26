/**
 * Service Builder View Tests
 * Tests for the ServiceBuilderView component
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../test-helpers';
import { ServiceBuilderView } from '@/components/service/ServiceBuilderView';

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

describe('ServiceBuilderView', () => {
  it('renders loading state initially', () => {
    render(<ServiceBuilderView serviceId="test-service-1" />);
    
    // Should show loading spinner
    expect(screen.getByTestId('spinner') || screen.queryByText(/loading/i)).toBeTruthy();
  });

  it('renders service builder with React Flow', async () => {
    render(<ServiceBuilderView serviceId="test-service-1" />);
    
    // Should render React Flow component
    await waitFor(() => {
      expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
  });

  it('renders read-only mode when readOnly prop is true', () => {
    render(<ServiceBuilderView serviceId="test-service-1" readOnly />);
    
    // Component should render (readOnly might affect interactions, not visibility)
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('renders background, controls, and minimap', async () => {
    render(<ServiceBuilderView serviceId="test-service-1" />);
    
    await waitFor(() => {
      expect(screen.getByTestId('background')).toBeInTheDocument();
      expect(screen.getByTestId('controls')).toBeInTheDocument();
      expect(screen.getByTestId('minimap')).toBeInTheDocument();
    });
  });
});

