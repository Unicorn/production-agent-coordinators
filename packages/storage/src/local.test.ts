import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { LocalFileStorage } from "./local";

describe("LocalFileStorage", () => {
  const testDir = path.join(__dirname, "../test-storage");
  let storage: LocalFileStorage;

  beforeEach(async () => {
    storage = new LocalFileStorage(testDir);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should write and read data", async () => {
    const key = "test/file.txt";
    const data = "Hello, World!";

    const url = await storage.write(key, data);
    const readData = await storage.read(key);

    expect(url).toContain("file://");
    expect(readData.toString()).toBe(data);
  });

  it("should check if file exists", async () => {
    const key = "test/exists.txt";

    const beforeWrite = await storage.exists(key);
    await storage.write(key, "data");
    const afterWrite = await storage.exists(key);

    expect(beforeWrite).toBe(false);
    expect(afterWrite).toBe(true);
  });

  it("should list files with prefix", async () => {
    await storage.write("workflows/wf1/file1.txt", "data1");
    await storage.write("workflows/wf1/file2.txt", "data2");
    await storage.write("workflows/wf2/file3.txt", "data3");

    const files = await storage.list("workflows/wf1");

    expect(files).toHaveLength(2);
    expect(files).toContain("workflows/wf1/file1.txt");
    expect(files).toContain("workflows/wf1/file2.txt");
  });

  it("should prevent directory traversal (escaping base directory)", async () => {
    const maliciousKey = "../../../outside.txt";

    // Should not escape base directory
    const url = await storage.write(maliciousKey, "data");

    // Verify file was written inside base directory
    expect(url).toContain(testDir);

    // Verify nothing was written outside base directory
    const parentDir = path.dirname(testDir);
    const parentFiles = await fs.readdir(parentDir);
    expect(parentFiles.includes("outside.txt")).toBe(false);
  });

  it("should prevent sensitive system path components", async () => {
    // Try to create file with sensitive path component
    await expect(storage.write("etc/passwd", "data")).rejects.toThrow("Sensitive path component");
    await expect(storage.write("bin/sh", "data")).rejects.toThrow("Sensitive path component");
    await expect(storage.write("var/log/system.log", "data")).rejects.toThrow("Sensitive path component");
  });

  it("should prevent both directory traversal AND sensitive paths together", async () => {
    const maliciousKey = "../../../etc/passwd";

    // Should block because of "etc" sensitive component
    await expect(storage.write(maliciousKey, "hacker")).rejects.toThrow("Sensitive path component");

    // Verify nothing was written
    const files = await fs.readdir(testDir, { recursive: true });
    expect(files.length).toBe(0);
  });
});
