# Storage Package Architecture

**Package:** `@coordinator/storage`
**Location:** `/Users/mattbernier/projects/coordinator/packages/storage/`
**Dependencies:** `@coordinator/contracts` only
**Status:** Core Package - Stable API

## Purpose

The Storage package provides secure, abstracted storage implementations for workflow artifacts. Currently implements local file system storage with path validation and security controls. Future implementations will include S3, GCS, and database blob storage.

## Design Philosophy

### WHY Storage Abstraction

Storage abstraction provides:

1. **Environment Independence:** Swap local → cloud storage without code changes
2. **Security:** Centralized path validation prevents directory traversal
3. **Testability:** Easy to mock storage in tests
4. **Consistency:** Uniform interface across storage backends

### WHY Security First

Security is critical because:

1. **Untrusted Input:** Storage keys may come from LLM output
2. **System Protection:** Prevent access to sensitive system paths
3. **Data Isolation:** Ensure artifacts stay within designated boundaries
4. **Audit Trail:** Track all storage operations

## Architecture

### File Structure

```
packages/storage/src/
├── local.ts              # LocalFileStorage implementation
├── index.ts              # Public exports
└── local.test.ts         # LocalFileStorage tests
```

### IStorage Interface

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/interfaces.ts`

```typescript
interface IStorage {
  write(key: string, data: Buffer | string): Promise<string>;
  read(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}
```

**WHY THESE METHODS:**
- `write`: Store artifacts (code, JSON, text)
- `read`: Retrieve artifacts for processing
- `exists`: Check before read/write operations
- `delete`: Cleanup temporary artifacts
- `list`: Discover artifacts with common prefix

## LocalFileStorage Implementation

### Class Structure

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/storage/src/local.ts:5-93`

```typescript
export class LocalFileStorage implements IStorage {
  private static readonly FORBIDDEN_SEGMENTS = new Set([...]);

  constructor(private baseDir: string) {}

  async write(key: string, data: Buffer | string): Promise<string>
  async read(key: string): Promise<Buffer>
  async exists(key: string): Promise<boolean>
  async delete(key: string): Promise<void>
  async list(prefix: string): Promise<string[]>

  private resolvePath(key: string): string
}
```

### Base Directory

**PURPOSE:** All file operations are scoped to a base directory.

**EXAMPLE:**

```typescript
const storage = new LocalFileStorage('./output');

// All keys are resolved relative to './output'
await storage.write('results/data.json', '{"foo": "bar"}');
// Writes to: ./output/results/data.json
```

**WHY:**
- Isolates artifacts from application code
- Simplifies cleanup (delete base directory)
- Prevents accidental file overwrites

## Security Architecture

### Threat Model

**THREATS:**

1. **Directory Traversal:** Malicious key like `../../etc/passwd`
2. **System Path Access:** Access to `/etc`, `/usr`, `/bin`, etc.
3. **Absolute Path Injection:** Key like `/etc/passwd`
4. **Hidden Segments:** Keys with `.` or `..` components

### Defense Layers

#### Layer 1: Path Normalization

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/storage/src/local.ts:74-79`

```typescript
// Split path into segments
const segments = key.split(/[/\\]/);

// Filter out traversal attempts (. and ..)
const cleanedSegments = segments.filter(
  seg => seg !== ".." && seg !== "." && seg !== ""
);
```

**WHY:**
- Removes all `..` segments (prevents traversal)
- Removes `.` segments (no-ops)
- Removes empty segments (from leading/trailing slashes)

#### Layer 2: Forbidden Segment Blocking

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/storage/src/local.ts:7-27`

```typescript
private static readonly FORBIDDEN_SEGMENTS = new Set([
  "etc", "bin", "sbin", "var", "usr", "lib", "lib64",
  "boot", "dev", "proc", "sys", "root", "home",
  "tmp", "opt", "mnt", "media", "srv", "run",
]);
```

**VALIDATION:**

```typescript
for (const segment of cleanedSegments) {
  const lowerSegment = segment.toLowerCase();
  if (LocalFileStorage.FORBIDDEN_SEGMENTS.has(lowerSegment)) {
    throw new Error(`Sensitive path component detected: "${segment}"`);
  }
}
```

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/storage/src/local.ts:82-87`

**WHY:**
- Blocks access to sensitive system directories
- Case-insensitive check (prevents `ETC` bypass)
- Throws error with specific segment for debugging

#### Layer 3: Path Join and Resolution

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/storage/src/local.ts:89-92`

```typescript
// Join and resolve within base directory
const safePath = cleanedSegments.join(path.sep);
return path.join(this.baseDir, safePath);
```

**WHY:**
- `path.join` prevents absolute paths (removes leading `/`)
- `path.sep` ensures platform-correct separators
- Result is always within `baseDir`

### Attack Examples

#### Example 1: Directory Traversal

```typescript
const storage = new LocalFileStorage('./output');

// ATTACK: Try to escape via ../
await storage.write('../../etc/passwd', 'malicious');

// DEFENSE: Segments filtered
// ['..', '..', 'etc', 'passwd']
//   ↓ (filter . and ..)
// ['etc', 'passwd']
//   ↓ (forbidden segment check)
// ❌ Error: Sensitive path component detected: "etc"
```

#### Example 2: Absolute Path

```typescript
// ATTACK: Absolute path
await storage.write('/etc/passwd', 'malicious');

// DEFENSE:
// ['/etc/passwd']
//   ↓ (split on /)
// ['', 'etc', 'passwd']
//   ↓ (filter empty)
// ['etc', 'passwd']
//   ↓ (forbidden segment check)
// ❌ Error: Sensitive path component detected: "etc"
```

#### Example 3: Mixed Traversal

```typescript
// ATTACK: Mix of . and ..
await storage.write('foo/./bar/../../../etc/passwd', 'malicious');

// DEFENSE:
// ['foo', '.', 'bar', '..', '..', '..', 'etc', 'passwd']
//   ↓ (filter . and ..)
// ['foo', 'bar', 'etc', 'passwd']
//   ↓ (forbidden segment check)
// ❌ Error: Sensitive path component detected: "etc"
```

## Write Operation

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/storage/src/local.ts:31-39`

```typescript
async write(key: string, data: Buffer | string): Promise<string> {
  const filePath = this.resolvePath(key);
  const dir = path.dirname(filePath);

  // Create parent directories if needed
  await fs.mkdir(dir, { recursive: true });

  // Write file
  await fs.writeFile(filePath, data, "utf8");

  // Return file:// URL
  return `file://${filePath}`;
}
```

**FEATURES:**
- **Auto-create directories:** No need to pre-create directory structure
- **UTF-8 encoding:** Consistent text encoding
- **Returns URL:** File URL for reference in artifacts

**EXAMPLE:**

```typescript
const url = await storage.write('results/output.txt', 'Hello, World!');
// Returns: "file://./output/results/output.txt"
```

## Read Operation

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/storage/src/local.ts:41-44`

```typescript
async read(key: string): Promise<Buffer> {
  const filePath = this.resolvePath(key);
  return await fs.readFile(filePath);
}
```

**FEATURES:**
- Returns Buffer (caller decides encoding)
- Throws if file doesn't exist (Node.js default)

**EXAMPLE:**

```typescript
const buffer = await storage.read('results/output.txt');
const text = buffer.toString('utf-8');
```

## Exists Operation

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/storage/src/local.ts:46-54`

```typescript
async exists(key: string): Promise<boolean> {
  const filePath = this.resolvePath(key);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
```

**WHY TRY-CATCH:**
- `fs.access` throws if file doesn't exist
- Convert exception to boolean

**EXAMPLE:**

```typescript
if (await storage.exists('results/cached.json')) {
  const data = await storage.read('results/cached.json');
}
```

## Delete Operation

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/storage/src/local.ts:56-59`

```typescript
async delete(key: string): Promise<void> {
  const filePath = this.resolvePath(key);
  await fs.unlink(filePath);
}
```

**BEHAVIOR:**
- Throws if file doesn't exist (Node.js default)
- Does not remove parent directories (even if empty)

**EXAMPLE:**

```typescript
await storage.delete('temp/scratch.json');
```

## List Operation

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/storage/src/local.ts:61-72`

```typescript
async list(prefix: string): Promise<string[]> {
  const dirPath = this.resolvePath(prefix);

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(prefix, entry.name));
  } catch {
    return [];  // Return empty array if directory doesn't exist
  }
}
```

**FEATURES:**
- Lists files only (not directories)
- Returns keys with prefix included
- Returns empty array if directory doesn't exist (no error)

**EXAMPLE:**

```typescript
const files = await storage.list('results');
// Returns: ['results/output.txt', 'results/data.json']
```

**LIMITATION:** Non-recursive (only immediate children)

**FUTURE:** Add recursive option

## Testing Strategy

### Security Tests

Test path validation with attack vectors:

```typescript
describe('LocalFileStorage security', () => {
  it('should block directory traversal', async () => {
    const storage = new LocalFileStorage('./output');

    await expect(
      storage.write('../../etc/passwd', 'attack')
    ).rejects.toThrow('Sensitive path component');
  });

  it('should block absolute paths', async () => {
    const storage = new LocalFileStorage('./output');

    await expect(
      storage.write('/etc/passwd', 'attack')
    ).rejects.toThrow('Sensitive path component');
  });

  it('should block system path segments', async () => {
    const storage = new LocalFileStorage('./output');

    const systemPaths = ['etc', 'usr', 'bin', 'var', 'root'];

    for (const segment of systemPaths) {
      await expect(
        storage.write(`foo/${segment}/bar`, 'attack')
      ).rejects.toThrow(`Sensitive path component detected: "${segment}"`);
    }
  });
});
```

### Functional Tests

Test normal operations:

```typescript
describe('LocalFileStorage operations', () => {
  let storage: LocalFileStorage;
  let testDir: string;

  beforeEach(() => {
    testDir = './test-output';
    storage = new LocalFileStorage(testDir);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should write and read file', async () => {
    const content = 'Hello, World!';
    await storage.write('test.txt', content);

    const buffer = await storage.read('test.txt');
    expect(buffer.toString('utf-8')).toBe(content);
  });

  it('should create nested directories', async () => {
    await storage.write('a/b/c/file.txt', 'nested');

    const exists = await storage.exists('a/b/c/file.txt');
    expect(exists).toBe(true);
  });
});
```

## Future Storage Implementations

### S3Storage

**PLANNED INTERFACE:**

```typescript
export class S3Storage implements IStorage {
  constructor(
    private bucket: string,
    private region: string,
    private credentials: AWSCredentials
  ) {}

  async write(key: string, data: Buffer | string): Promise<string> {
    await s3.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: data,
    });
    return `s3://${this.bucket}/${key}`;
  }

  // ... other methods
}
```

**SECURITY:**
- No path traversal risk (S3 keys are not file paths)
- Bucket policy enforcement
- IAM role-based access control

### DatabaseBlobStorage

**PLANNED INTERFACE:**

```typescript
export class DatabaseBlobStorage implements IStorage {
  constructor(private db: Database) {}

  async write(key: string, data: Buffer | string): Promise<string> {
    const id = uuid();
    await this.db.blobs.create({
      id,
      key,
      data: Buffer.from(data),
      createdAt: new Date(),
    });
    return `blob://${id}`;
  }

  // ... other methods
}
```

**ADVANTAGES:**
- Transactional with workflow state
- Easy backup/restore
- Efficient querying

## Configuration

### Environment Variables

**FUTURE:** Support environment-based configuration

```typescript
const storage = createStorage({
  type: process.env.STORAGE_TYPE || 'local',
  config: {
    local: { baseDir: process.env.STORAGE_BASE_DIR || './output' },
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
    },
  },
});
```

## Performance Considerations

### Local Storage

**PROS:**
- Fast for development
- No network latency
- Simple debugging

**CONS:**
- Not scalable across machines
- No durability guarantees
- Limited to local disk space

### Future Optimizations

**Caching:**
- In-memory cache for frequently read artifacts
- LRU eviction policy

**Batching:**
- Batch write operations
- Multipart uploads for large files

**Compression:**
- Compress text artifacts (JSON, code)
- Transparent decompression on read

## Related Documentation

- [Overview](./overview.md) - System architecture
- [Coordinator](./coordinator.md) - DI and service registration
- [Design: Principles](../design/principles.md) - Security principles
- [Operations: Deployment](../operations/deployment.md) - Production storage setup

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-09 | Internal Docs Agent | Initial creation |
