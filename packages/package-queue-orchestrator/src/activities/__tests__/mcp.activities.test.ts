import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryMCPForPackages, updateMCPPackageStatus, signalOrchestrator } from '../mcp.activities.js';
import type { Package } from '../../types/index.js';

// Mock the MCP client
vi.mock('../mcp-client.js', () => ({
  mcpClient: {
    callTool: vi.fn(),
  },
}));

// Mock Temporal client
vi.mock('@temporalio/client', () => ({
  Connection: {
    connect: vi.fn(),
  },
  WorkflowClient: vi.fn(),
}));

import { mcpClient } from '../mcp-client.js';
import { Connection, WorkflowClient } from '@temporalio/client';

describe('MCP Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('queryMCPForPackages', () => {
    it('should query MCP for packages ready to build', async () => {
      // Arrange
      const mockMCPResponse = {
        packages: [
          {
            id: 'pkg-1',
            name: '@bernierllc/package-a',
            priority: 100,
            dependencies: [],
            category: 'core',
            status: 'ready',
          },
          {
            id: 'pkg-2',
            name: '@bernierllc/package-b',
            priority: 90,
            dependencies: ['@bernierllc/package-a'],
            category: 'utils',
            status: 'ready',
          },
        ],
      };

      vi.mocked(mcpClient.callTool).mockResolvedValue(mockMCPResponse);

      // Act
      const packages = await queryMCPForPackages(10);

      // Assert
      expect(mcpClient.callTool).toHaveBeenCalledWith('packages_get_build_queue', {
        limit: 10,
        filters: {
          exclude_blocked: true,
        },
      });

      expect(packages).toHaveLength(2);
      expect(packages[0]).toEqual({
        name: '@bernierllc/package-a',
        priority: 100,
        dependencies: [],
      });
      expect(packages[1]).toEqual({
        name: '@bernierllc/package-b',
        priority: 90,
        dependencies: ['@bernierllc/package-a'],
      });
    });

    it('should return empty array when no packages available', async () => {
      // Arrange
      const mockMCPResponse = {
        packages: [],
      };

      vi.mocked(mcpClient.callTool).mockResolvedValue(mockMCPResponse);

      // Act
      const packages = await queryMCPForPackages(10);

      // Assert
      expect(packages).toEqual([]);
    });

    it('should handle MCP API errors gracefully', async () => {
      // Arrange
      vi.mocked(mcpClient.callTool).mockRejectedValue(new Error('MCP API unavailable'));

      // Act & Assert
      await expect(queryMCPForPackages(10)).rejects.toThrow('MCP API unavailable');
    });

    it('should use default limit if not provided', async () => {
      // Arrange
      const mockMCPResponse = { packages: [] };
      vi.mocked(mcpClient.callTool).mockResolvedValue(mockMCPResponse);

      // Act
      await queryMCPForPackages(10);

      // Assert
      expect(mcpClient.callTool).toHaveBeenCalledWith('packages_get_build_queue', {
        limit: 10,
        filters: {
          exclude_blocked: true,
        },
      });
    });

    it('should transform MCP package format to internal Package format', async () => {
      // Arrange
      const mockMCPResponse = {
        packages: [
          {
            id: 'some-uuid',
            name: '@bernierllc/test',
            priority: 50,
            dependencies: ['dep1', 'dep2'],
            category: 'agent',
            status: 'ready',
            current_version: '1.0.0',
            // ... other MCP fields we don't need
          },
        ],
      };

      vi.mocked(mcpClient.callTool).mockResolvedValue(mockMCPResponse);

      // Act
      const packages = await queryMCPForPackages(5);

      // Assert - should only have fields from Package interface
      expect(packages[0]).toEqual({
        name: '@bernierllc/test',
        priority: 50,
        dependencies: ['dep1', 'dep2'],
      });
      expect(packages[0]).not.toHaveProperty('id');
      expect(packages[0]).not.toHaveProperty('category');
      expect(packages[0]).not.toHaveProperty('status');
    });
  });

  describe('updateMCPPackageStatus', () => {
    it('should update package status to published on success', async () => {
      // Arrange
      vi.mocked(mcpClient.callTool).mockResolvedValue({ success: true });

      // Act
      await updateMCPPackageStatus('@bernierllc/test-package', 'published');

      // Assert
      expect(mcpClient.callTool).toHaveBeenCalledWith('packages_update', {
        id: '@bernierllc/test-package',
        data: {
          status: 'published',
        },
      });
    });

    it('should update package status to failed with error details', async () => {
      // Arrange
      vi.mocked(mcpClient.callTool).mockResolvedValue({ success: true });
      const errorDetails = 'Build failed: tests did not pass';

      // Act
      await updateMCPPackageStatus('@bernierllc/test-package', 'failed', errorDetails);

      // Assert
      expect(mcpClient.callTool).toHaveBeenCalledWith('packages_update', {
        id: '@bernierllc/test-package',
        data: {
          status: 'failed',
          metadata: {
            error: errorDetails,
          },
        },
      });
    });

    it('should handle MCP update errors', async () => {
      // Arrange
      vi.mocked(mcpClient.callTool).mockRejectedValue(new Error('Update failed'));

      // Act & Assert
      await expect(
        updateMCPPackageStatus('@bernierllc/test', 'published')
      ).rejects.toThrow('Update failed');
    });

    it('should support various status values', async () => {
      // Arrange
      vi.mocked(mcpClient.callTool).mockResolvedValue({ success: true });

      // Act
      await updateMCPPackageStatus('@bernierllc/test', 'building');

      // Assert
      expect(mcpClient.callTool).toHaveBeenCalledWith('packages_update', {
        id: '@bernierllc/test',
        data: {
          status: 'building',
        },
      });
    });

    it('should work without error details', async () => {
      // Arrange
      vi.mocked(mcpClient.callTool).mockResolvedValue({ success: true });

      // Act
      await updateMCPPackageStatus('@bernierllc/test', 'published');

      // Assert
      expect(mcpClient.callTool).toHaveBeenCalledWith('packages_update', {
        id: '@bernierllc/test',
        data: {
          status: 'published',
        },
      });
    });
  });

  describe('signalOrchestrator', () => {
    it('should signal the orchestrator workflow with packages', async () => {
      // Arrange
      const mockPackages: Package[] = [
        { name: '@bernierllc/pkg-a', priority: 100, dependencies: [] },
        { name: '@bernierllc/pkg-b', priority: 90, dependencies: ['@bernierllc/pkg-a'] },
      ];

      const mockSignal = vi.fn();
      const mockGetHandle = vi.fn().mockReturnValue({ signal: mockSignal });
      const mockConnection = {};

      vi.mocked(Connection.connect).mockResolvedValue(mockConnection as any);
      vi.mocked(WorkflowClient).mockReturnValue({ getHandle: mockGetHandle } as any);

      // Act
      await signalOrchestrator('newPackages', mockPackages);

      // Assert
      expect(Connection.connect).toHaveBeenCalledWith({
        address: 'localhost:7233',
      });
      expect(WorkflowClient).toHaveBeenCalledWith({ connection: mockConnection });
      expect(mockGetHandle).toHaveBeenCalledWith('continuous-builder-orchestrator');
      expect(mockSignal).toHaveBeenCalledWith('newPackages', mockPackages);
    });

    it('should use TEMPORAL_ADDRESS environment variable if set', async () => {
      // Arrange
      const originalEnv = process.env.TEMPORAL_ADDRESS;
      process.env.TEMPORAL_ADDRESS = 'temporal.example.com:7233';

      const mockSignal = vi.fn();
      const mockGetHandle = vi.fn().mockReturnValue({ signal: mockSignal });
      const mockConnection = {};

      vi.mocked(Connection.connect).mockResolvedValue(mockConnection as any);
      vi.mocked(WorkflowClient).mockReturnValue({ getHandle: mockGetHandle } as any);

      // Act
      await signalOrchestrator('newPackages', []);

      // Assert
      expect(Connection.connect).toHaveBeenCalledWith({
        address: 'temporal.example.com:7233',
      });

      // Cleanup
      if (originalEnv) {
        process.env.TEMPORAL_ADDRESS = originalEnv;
      } else {
        delete process.env.TEMPORAL_ADDRESS;
      }
    });

    it('should handle connection errors', async () => {
      // Arrange
      vi.mocked(Connection.connect).mockRejectedValue(new Error('Connection failed'));

      // Act & Assert
      await expect(signalOrchestrator('newPackages', [])).rejects.toThrow('Connection failed');
    });

    it('should handle signal errors', async () => {
      // Arrange
      const mockSignal = vi.fn().mockRejectedValue(new Error('Signal failed'));
      const mockGetHandle = vi.fn().mockReturnValue({ signal: mockSignal });
      const mockConnection = {};

      vi.mocked(Connection.connect).mockResolvedValue(mockConnection as any);
      vi.mocked(WorkflowClient).mockReturnValue({ getHandle: mockGetHandle } as any);

      // Act & Assert
      await expect(signalOrchestrator('newPackages', [])).rejects.toThrow('Signal failed');
    });
  });
});
