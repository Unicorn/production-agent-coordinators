import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scanForUnplannedPackages } from '../mcp.activities';

describe('MCP Activities - Scanner', () => {
  beforeEach(() => {
    // Mock fetch for MCP API calls
    global.fetch = vi.fn();
    process.env.MBERNIER_API_KEY = 'test-api-key';
    process.env.MBERNIER_API_URL = 'http://localhost:3355/api/v1';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('scanForUnplannedPackages', () => {
    it('should return packages that are published but have no plan file', async () => {
      // Mock MCP API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: '@bernierllc/unplanned-package-1',
              name: 'unplanned-package-1',
              status: 'published',
              plan_file_path: null
            },
            {
              id: '@bernierllc/unplanned-package-2',
              name: 'unplanned-package-2',
              status: 'published',
              plan_file_path: null
            }
          ]
        })
      } as Response);

      const result = await scanForUnplannedPackages();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('@bernierllc/unplanned-package-1');
      expect(result[1].id).toBe('@bernierllc/unplanned-package-2');

      // Verify correct API call
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3355/api/v1/packages?filters[status]=published&filters[no_plan_file]=true',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should return empty array when no unpublished packages found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] })
      } as Response);

      const result = await scanForUnplannedPackages();

      expect(result).toHaveLength(0);
    });

    it('should throw error when MCP API fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      } as Response);

      await expect(scanForUnplannedPackages()).rejects.toThrow('MCP API error: 500');
    });
  });
});
