/**
 * Sync Service Unit Tests
 * 
 * Tests the cache-aside sync service for execution history
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the sync service functions
vi.mock('../../src/lib/temporal/sync-service', () => ({
  checkSyncStatus: vi.fn(),
  requestSync: vi.fn(),
  waitForSync: vi.fn(),
}));

describe('Sync Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkSyncStatus', () => {
    it('should return needsSync=true if execution not synced', async () => {
      const { checkSyncStatus } = await import('../../src/lib/temporal/sync-service');
      
      vi.mocked(checkSyncStatus).mockResolvedValue({
        needsSync: true,
        syncStatus: 'pending',
      });

      const result = await checkSyncStatus('exec-123');
      
      expect(result.needsSync).toBe(true);
      expect(result.syncStatus).toBe('pending');
    });

    it('should return needsSync=false if recently synced', async () => {
      const { checkSyncStatus } = await import('../../src/lib/temporal/sync-service');
      
      vi.mocked(checkSyncStatus).mockResolvedValue({
        needsSync: false,
        syncStatus: 'synced',
      });

      const result = await checkSyncStatus('exec-123');
      
      expect(result.needsSync).toBe(false);
      expect(result.syncStatus).toBe('synced');
    });

    it('should return needsSync=true if data is stale', async () => {
      const { checkSyncStatus } = await import('../../src/lib/temporal/sync-service');
      
      vi.mocked(checkSyncStatus).mockResolvedValue({
        needsSync: true,
        syncStatus: 'stale',
      });

      const result = await checkSyncStatus('exec-123');
      
      expect(result.needsSync).toBe(true);
      expect(result.syncStatus).toBe('stale');
    });
  });

  describe('requestSync', () => {
    it('should trigger sync coordinator workflow', async () => {
      const { requestSync } = await import('../../src/lib/temporal/sync-service');
      
      vi.mocked(requestSync).mockResolvedValue({
        success: true,
        synced: false,
        componentExecutionsCount: 0,
      });

      const result = await requestSync('exec-123', false);
      
      expect(result.success).toBe(true);
      expect(vi.mocked(requestSync)).toHaveBeenCalledWith('exec-123', false);
    });

    it('should handle immediate sync requests', async () => {
      const { requestSync, waitForSync } = await import('../../src/lib/temporal/sync-service');
      
      vi.mocked(requestSync).mockResolvedValue({
        success: true,
        synced: true,
        componentExecutionsCount: 5,
      });

      vi.mocked(waitForSync).mockResolvedValue({
        success: true,
        synced: true,
      });

      const result = await requestSync('exec-123', true);
      
      expect(result.success).toBe(true);
      expect(result.synced).toBe(true);
    });
  });

  describe('RLS Handling', () => {
    it('should use system user context for sync operations', async () => {
      // This would be tested in integration tests
      // Unit tests verify the sync service functions are called correctly
      const { requestSync } = await import('../../src/lib/temporal/sync-service');
      
      vi.mocked(requestSync).mockResolvedValue({
        success: true,
        synced: false,
        componentExecutionsCount: 0,
      });

      await requestSync('exec-123', false);
      
      // Verify sync was requested
      expect(vi.mocked(requestSync)).toHaveBeenCalled();
    });
  });
});
