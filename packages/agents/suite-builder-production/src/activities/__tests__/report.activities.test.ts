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
});
