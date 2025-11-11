import * as fs from 'fs/promises';
import * as path from 'path';
import type { PackageBuildReport, SuiteReport } from '../types/index';

export async function writePackageBuildReport(
  report: PackageBuildReport,
  workspaceRoot: string
): Promise<void> {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const reportDir = path.join(workspaceRoot, 'production', 'reports', date);
  const sanitizedName = report.packageName.replace(/@/g, '').replace(/\//g, '-');
  const reportPath = path.join(reportDir, `${sanitizedName}.json`);

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`📊 Report written: ${reportPath}`);
}

export async function loadAllPackageReports(
  suiteId: string,
  workspaceRoot: string
): Promise<PackageBuildReport[]> {
  const date = new Date().toISOString().split('T')[0];
  const reportDir = path.join(workspaceRoot, 'production', 'reports', date);

  try {
    const files = await fs.readdir(reportDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'suite-summary.json');

    const reports = await Promise.all(
      jsonFiles.map(async (file) => {
        const content = await fs.readFile(path.join(reportDir, file), 'utf-8');
        return JSON.parse(content) as PackageBuildReport;
      })
    );

    return reports;
  } catch (error) {
    console.warn(`No reports found in ${reportDir}`);
    return [];
  }
}

export async function writeSuiteReport(
  report: SuiteReport,
  workspaceRoot: string
): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  const reportDir = path.join(workspaceRoot, 'production', 'reports', date);
  const reportPath = path.join(reportDir, 'suite-summary.json');

  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`📊 Suite report written: ${reportPath}`);
}
