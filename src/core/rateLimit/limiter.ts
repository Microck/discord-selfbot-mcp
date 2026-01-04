type Task<T> = () => Promise<T>;

interface QueuedTask<T> {
  task: Task<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export class RateLimiter {
  private queue: QueuedTask<unknown>[] = [];
  private running = 0;
  private readonly concurrency: number;
  private readonly minDelay: number;
  private lastRun = 0;

  constructor(concurrency = 3, minDelayMs = 50) {
    this.concurrency = concurrency;
    this.minDelay = minDelayMs;
  }

  async run<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject } as QueuedTask<unknown>);
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.running++;

    const now = Date.now();
    const timeSinceLastRun = now - this.lastRun;
    if (timeSinceLastRun < this.minDelay) {
      await this.sleep(this.minDelay - timeSinceLastRun);
    }

    try {
      this.lastRun = Date.now();
      const result = await item.task();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async backoff(retryAfterMs: number): Promise<void> {
    await this.sleep(retryAfterMs);
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get activeCount(): number {
    return this.running;
  }
}
