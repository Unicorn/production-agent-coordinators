import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { IStorage } from "@coordinator/contracts";

export class LocalFileStorage implements IStorage {
  // Sensitive system path components that should never be used
  private static readonly FORBIDDEN_SEGMENTS = new Set([
    "etc",
    "bin",
    "sbin",
    "var",
    "usr",
    "lib",
    "lib64",
    "boot",
    "dev",
    "proc",
    "sys",
    "root",
    "home",
    "tmp",
    "opt",
    "mnt",
    "media",
    "srv",
    "run",
  ]);

  constructor(private baseDir: string) {}

  async write(key: string, data: Buffer | string): Promise<string> {
    const filePath = this.resolvePath(key);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, data, "utf8");

    return `file://${filePath}`;
  }

  async read(key: string): Promise<Buffer> {
    const filePath = this.resolvePath(key);
    return await fs.readFile(filePath);
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.unlink(filePath);
  }

  async list(prefix: string): Promise<string[]> {
    const dirPath = this.resolvePath(prefix);

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(prefix, entry.name));
    } catch {
      return [];
    }
  }

  private resolvePath(key: string): string {
    // 1. Split path into segments
    const segments = key.split(/[\/\\]/);

    // 2. Filter out traversal attempts (. and ..)
    const cleanedSegments = segments.filter(seg => seg !== ".." && seg !== "." && seg !== "");

    // 3. Check for sensitive system path components
    for (const segment of cleanedSegments) {
      const lowerSegment = segment.toLowerCase();
      if (LocalFileStorage.FORBIDDEN_SEGMENTS.has(lowerSegment)) {
        throw new Error(`Sensitive path component detected: "${segment}"`);
      }
    }

    // 4. Join and resolve within base directory
    const safePath = cleanedSegments.join(path.sep);
    return path.join(this.baseDir, safePath);
  }
}
