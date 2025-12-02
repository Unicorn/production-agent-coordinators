import { spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WorkerManagerOptions {
  taskQueue: string;
  workerScript?: string;
  checkInterval?: number;
  maxWaitTime?: number;
  autoCleanup?: boolean;
}

export interface WorkerInfo {
  pid: number;
  process: ChildProcess;
  taskQueue: string;
  startedAt: Date;
}

const activeWorkers = new Map<string, WorkerInfo>();

export async function isWorkerRunning(taskQueue: string): Promise<boolean> {
  const info = activeWorkers.get(taskQueue);
  if (!info) {
    return false;
  }

  try {
    process.kill(info.pid, 0);
    return true;
  } catch {
    activeWorkers.delete(taskQueue);
    return false;
  }
}

export async function startWorker(options: WorkerManagerOptions): Promise<WorkerInfo> {
  const {
    taskQueue,
    workerScript = path.join(__dirname, 'worker.ts'),
    checkInterval = 500,
    maxWaitTime = 30_000,
    autoCleanup = false,
  } = options;

  if (await isWorkerRunning(taskQueue)) {
    const existing = activeWorkers.get(taskQueue);
    if (existing) {
      return existing;
    }
  }

  const workerProcess = spawn('npx', ['tsx', workerScript], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      TEMPORAL_TASK_QUEUE: taskQueue,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  const buffer: string[] = [];
  let ready = false;

  workerProcess.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    buffer.push(text);
    if (text.includes('Worker is ready') || text.includes('Waiting for workflows')) {
      ready = true;
    }
  });

  workerProcess.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    buffer.push(text);
    // eslint-disable-next-line no-console
    console.error(`[worker:${taskQueue}] ${text}`);
  });

  workerProcess.on('exit', (code: number | null) => {
    if (code !== null && code !== 0) {
      // eslint-disable-next-line no-console
      console.error(`Worker for ${taskQueue} exited with code ${code}`);
      // eslint-disable-next-line no-console
      console.error(buffer.join(''));
    }
    activeWorkers.delete(taskQueue);
  });

  const startTime = Date.now();
  // eslint-disable-next-line no-await-in-loop
  while (!ready && Date.now() - startTime < maxWaitTime) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  if (!ready) {
    workerProcess.kill('SIGKILL');
    throw new Error(
      `Worker failed to start within ${maxWaitTime}ms. Output:\n${buffer.join('')}`,
    );
  }

  const info: WorkerInfo = {
    pid: workerProcess.pid ?? -1,
    process: workerProcess,
    taskQueue,
    startedAt: new Date(),
  };

  activeWorkers.set(taskQueue, info);

  if (autoCleanup) {
    process.on('exit', () => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      stopWorker(taskQueue);
    });
  }

  return info;
}

export async function stopWorker(taskQueue: string): Promise<void> {
  const info = activeWorkers.get(taskQueue);
  if (!info) {
    return;
  }

  try {
    info.process.kill('SIGTERM');

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        info.process.kill('SIGKILL');
        resolve();
      }, 5_000);

      info.process.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  } catch {
    // ignore
  } finally {
    activeWorkers.delete(taskQueue);
  }
}

export async function ensureWorkerRunning(
  options: WorkerManagerOptions,
): Promise<WorkerInfo> {
  if (await isWorkerRunning(options.taskQueue)) {
    const existing = activeWorkers.get(options.taskQueue);
    if (existing) {
      return existing;
    }
  }

  return startWorker(options);
}

export async function stopAllWorkers(): Promise<void> {
  const queues = Array.from(activeWorkers.keys());
  await Promise.all(queues.map((q) => stopWorker(q)));
}


