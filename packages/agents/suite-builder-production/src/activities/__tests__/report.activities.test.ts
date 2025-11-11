import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writePackageBuildReport, loadAllPackageReports, writeSuiteReport } from '../report.activities';
import * as fs from 'fs/promises';
import type { PackageBuildReport } from '../../types/index';

vi.mock('fs/promises');

describe('Report Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('writePackageBuildReport', () => {
    it('should write report to correct location', async () => {
      const report: PackageBuildReport = {
        packageName: '@bernierllc/test-package',
        workflowId: 'wf-123',
        startTime: '2025-11-10T10:00:00Z',
        endTime: '2025-11-10T10:05:00Z',
        duration: 300000,
        buildMetrics: {
          buildTime: 100000,
          testTime: 150000,
          qualityCheckTime: 30000,
          publishTime: 20000
        },
        quality: {
          lintScore: 100,
          testCoverage: 85,
          typeScriptErrors: 0,
          passed: true
        },
        fixAttempts: [],
        status: 'success',
        dependencies: [],
        waitedFor: []
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await writePackageBuildReport(report, '/workspace');

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('production/reports'),
        expect.stringContaining('"packageName": "@bernierllc/test-package"')
      );
    });
  });

  describe('loadAllPackageReports', () => {
    it('should load all package reports from directory', async () => {
      const mockReport1: PackageBuildReport = {
        packageName: '@bernierllc/package-1',
        workflowId: 'wf-1',
        startTime: '2025-11-10T10:00:00Z',
        endTime: '2025-11-10T10:05:00Z',
        duration: 300000,
        buildMetrics: {
          buildTime: 100000,
          testTime: 150000,
          qualityCheckTime: 30000,
          publishTime: 20000
        },
        quality: {
          lintScore: 100,
          testCoverage: 85,
          typeScriptErrors: 0,
          passed: true
        },
        fixAttempts: [],
        status: 'success',
        dependencies: [],
        waitedFor: []
      };

      const mockReport2: PackageBuildReport = {
        packageName: '@bernierllc/package-2',
        workflowId: 'wf-2',
        startTime: '2025-11-10T10:10:00Z',
        endTime: '2025-11-10T10:15:00Z',
        duration: 250000,
        buildMetrics: {
          buildTime: 90000,
          testTime: 120000,
          qualityCheckTime: 25000,
          publishTime: 15000
        },
        quality: {
          lintScore: 95,
          testCoverage: 90,
          typeScriptErrors: 0,
          passed: true
        },
        fixAttempts: [],
        status: 'success',
        dependencies: [],
        waitedFor: []
      };

      vi.mocked(fs.readdir).mockResolvedValue([
        'bernierllc-package-1.json',
        'bernierllc-package-2.json',
        'suite-summary.json'
      ] as any);

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(mockReport1))
        .mockResolvedValueOnce(JSON.stringify(mockReport2));

      const reports = await loadAllPackageReports('suite-1', '/workspace');

      expect(reports).toHaveLength(2);
      expect(reports[0].packageName).toBe('@bernierllc/package-1');
      expect(reports[1].packageName).toBe('@bernierllc/package-2');
      expect(fs.readFile).toHaveBeenCalledTimes(2);
    });

    it('should filter out suite-summary.json', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'package-1.json',
        'suite-summary.json',
        'package-2.json'
      ] as any);

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        packageName: 'test',
        workflowId: 'wf-1',
        startTime: '2025-11-10T10:00:00Z',
        endTime: '2025-11-10T10:05:00Z',
        duration: 300000,
        buildMetrics: {
          buildTime: 100000,
          testTime: 150000,
          qualityCheckTime: 30000,
          publishTime: 20000
        },
        quality: {
          lintScore: 100,
          testCoverage: 85,
          typeScriptErrors: 0,
          passed: true
        },
        fixAttempts: [],
        status: 'success',
        dependencies: [],
        waitedFor: []
      }));

      await loadAllPackageReports('suite-1', '/workspace');

      // Should only read the two package files, not suite-summary.json
      expect(fs.readFile).toHaveBeenCalledTimes(2);
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('package-1.json'),
        'utf-8'
      );
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('package-2.json'),
        'utf-8'
      );
    });

    it('should return empty array when directory not found', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const reports = await loadAllPackageReports('suite-1', '/workspace');

      expect(reports).toEqual([]);
    });

    it('should handle malformed JSON gracefully', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        'valid.json',
        'invalid.json'
      ] as any);

      const validReport: PackageBuildReport = {
        packageName: '@bernierllc/valid',
        workflowId: 'wf-1',
        startTime: '2025-11-10T10:00:00Z',
        endTime: '2025-11-10T10:05:00Z',
        duration: 300000,
        buildMetrics: {
          buildTime: 100000,
          testTime: 150000,
          qualityCheckTime: 30000,
          publishTime: 20000
        },
        quality: {
          lintScore: 100,
          testCoverage: 85,
          typeScriptErrors: 0,
          passed: true
        },
        fixAttempts: [],
        status: 'success',
        dependencies: [],
        waitedFor: []
      };

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(JSON.stringify(validReport))
        .mockResolvedValueOnce('{ invalid json }');

      // Should handle malformed JSON by catching error and returning empty array
      const reports = await loadAllPackageReports('suite-1', '/workspace');

      expect(reports).toEqual([]);
    });
  });

  describe('writeSuiteReport', () => {
    it('should write suite report to correct location', async () => {
      const mockPackageReport: PackageBuildReport = {
        packageName: '@bernierllc/test-package',
        workflowId: 'wf-123',
        startTime: '2025-11-10T10:00:00Z',
        endTime: '2025-11-10T10:05:00Z',
        duration: 300000,
        buildMetrics: {
          buildTime: 100000,
          testTime: 150000,
          qualityCheckTime: 30000,
          publishTime: 20000
        },
        quality: {
          lintScore: 100,
          testCoverage: 85,
          typeScriptErrors: 0,
          passed: true
        },
        fixAttempts: [],
        status: 'success',
        dependencies: [],
        waitedFor: []
      };

      const suiteReport = {
        suiteId: 'suite-123',
        timestamp: '2025-11-10T10:00:00Z',
        totalPackages: 5,
        successful: 4,
        failed: 1,
        totalDuration: 1500000,
        totalFixAttempts: 3,
        slowestPackages: [mockPackageReport],
        mostFixAttempts: [mockPackageReport],
        totalWaitTime: 50000,
        packageReports: [mockPackageReport]
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await writeSuiteReport(suiteReport, '/workspace');

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('production/reports'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('suite-summary.json'),
        expect.stringContaining('"suiteId": "suite-123"')
      );
    });

    it('should create directory if it does not exist', async () => {
      const suiteReport = {
        suiteId: 'suite-456',
        timestamp: '2025-11-10T11:00:00Z',
        totalPackages: 2,
        successful: 2,
        failed: 0,
        totalDuration: 600000,
        totalFixAttempts: 0,
        slowestPackages: [],
        mostFixAttempts: [],
        totalWaitTime: 0,
        packageReports: []
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await writeSuiteReport(suiteReport, '/workspace');

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('production/reports'),
        { recursive: true }
      );
    });
  });
});
