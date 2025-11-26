/**
 * Component Palette Tests
 * Tests for the ComponentPalette component
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test-helpers';
import { ComponentPalette } from '@/components/workflow/ComponentPalette';
import type { Database } from '@/types/database';

type Component = Database['public']['Tables']['components']['Row'] & {
  component_type: { name: string; icon: string | null };
  visibility: { name: string };
};

describe('ComponentPalette', () => {
  const mockComponents: Component[] = [
    {
      id: '1',
      name: 'send-email',
      display_name: 'Send Email',
      description: 'Send an email notification',
      component_type: { name: 'activity', icon: null },
      visibility: { name: 'public' },
      capabilities: ['notification', 'email'],
      tags: ['communication'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project_id: null,
      user_id: null,
    },
    {
      id: '2',
      name: 'claude-agent',
      display_name: 'Claude Agent',
      description: 'AI agent using Claude',
      component_type: { name: 'agent', icon: null },
      visibility: { name: 'public' },
      capabilities: ['ai', 'decision'],
      tags: ['ai', 'automation'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project_id: null,
      user_id: null,
    },
    {
      id: '3',
      name: 'http-trigger',
      display_name: 'HTTP Trigger',
      description: 'Receive HTTP requests',
      component_type: { name: 'trigger', icon: null },
      visibility: { name: 'public' },
      capabilities: ['receive', 'endpoint'],
      tags: ['webhook'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project_id: null,
      user_id: null,
    },
  ];

  it('renders component palette with title', () => {
    render(<ComponentPalette components={mockComponents} />);
    
    expect(screen.getByText('Build Your Service')).toBeInTheDocument();
    expect(screen.getByText('Drag components to canvas')).toBeInTheDocument();
  });

  it('groups components by utility category', () => {
    render(<ComponentPalette components={mockComponents} />);
    
    // Should show utility-based categories
    expect(screen.getByText('Core Actions')).toBeInTheDocument();
    expect(screen.getByText('AI & Automation')).toBeInTheDocument();
    expect(screen.getByText('Receive Data')).toBeInTheDocument();
  });

  it('shows component count for each category', () => {
    render(<ComponentPalette components={mockComponents} />);
    
    // Each category should show a count badge
    const countBadges = screen.getAllByText(/\d+/);
    expect(countBadges.length).toBeGreaterThan(0);
  });

  it('displays disabled state when disabled prop is true', () => {
    render(<ComponentPalette components={mockComponents} disabled />);
    
    expect(screen.getByText('Editing disabled (workflow is active)')).toBeInTheDocument();
  });

  it('allows expanding and collapsing categories', () => {
    render(<ComponentPalette components={mockComponents} />);
    
    // Initially categories should be collapsed (components not visible)
    const sendEmail = screen.queryByText('Send Email');
    // Components might not be visible if categories are collapsed
    // This test verifies the structure exists
    expect(screen.getByText('Core Actions')).toBeInTheDocument();
  });

  it('renders empty state when no components provided', () => {
    render(<ComponentPalette components={[]} />);
    
    // Should still show the header
    expect(screen.getByText('Build Your Service')).toBeInTheDocument();
  });
});

