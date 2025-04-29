import { Lock } from "../interfaces/lock";
import { RunningLockEntry, WaitingLockEntry } from "../interfaces/lock-entry";
import { ReleaseFunction } from "../types/release-function.type";
import { LockOptions } from "./lock-mutex";

export type TryAcquireResponse = { acquired: boolean; release?: ReleaseFunction };

export type PoolLockOptions = LockOptions & { concurrentLimit?: number };

const defaultOptions: Required<PoolLockOptions> = { concurrentLimit: 1, queueType: "FIFO", releaseTimeout: 0 };

export class LockPool implements Lock {
  private readonly options: Required<PoolLockOptions>;
  private readonly waitingQueue = new Array<WaitingLockEntry>();
  private readonly runningQueue = new Map<RunningLockEntry, ReleaseFunction>();

  constructor(options?: PoolLockOptions) {
    this.options = this.sanitizeOptions(options);
  }

  public async acquire(): Promise<ReleaseFunction> {
    return new Promise<ReleaseFunction>((resolve, reject) => {
      const lockEntry = { resolve, reject } satisfies WaitingLockEntry;
      this.waitingQueue.push(lockEntry);
      this.dispatchNextLock();
    });
  }

  public tryAcquire(): TryAcquireResponse {
    const someOneIsWaitingTheLock = this.waitingQueue.length > 0;
    if (someOneIsWaitingTheLock) {
      return { acquired: false };
    }

    const conncurrentLimitReached = this.runningQueue.size >= this.options.concurrentLimit;
    if (conncurrentLimitReached) {
      return { acquired: false };
    }

    const lockEntry = {} as RunningLockEntry;
    const releaseFunction = this.buildReleaseFunction(lockEntry);
    this.runningQueue.set(lockEntry, releaseFunction);

    return { acquired: true, release: releaseFunction };
  }

  public locked(): boolean {
    const conncurrentLimitReached = this.runningQueue.size >= this.options.concurrentLimit;
    return conncurrentLimitReached;
  }

  public releaseAll(): void {
    for (const [, releaseFunction] of this.runningQueue) {
      releaseFunction();
    }
  }

  private buildReleaseFunction(lockEntry: RunningLockEntry): ReleaseFunction {
    const releaseFunction: ReleaseFunction = () => {
      if (!this.runningQueue.has(lockEntry)) {
        return;
      }

      if (lockEntry.releaseTimeoutId) {
        clearTimeout(lockEntry.releaseTimeoutId);
      }

      this.runningQueue.delete(lockEntry);
      this.dispatchNextLock();
    };

    if (this.options.releaseTimeout > 0) {
      lockEntry.releaseTimeoutId = setTimeout(() => {
        releaseFunction();
      }, this.options.releaseTimeout);
    }

    return releaseFunction;
  }

  private dispatchNextLock(): void {
    if (this.locked()) {
      return;
    }

    const nextLock = this.getNextLockToRun();
    if (!nextLock) {
      return;
    }

    const lockEntry = {} as RunningLockEntry;
    const releaseFunction = this.buildReleaseFunction(lockEntry);
    this.runningQueue.set(lockEntry, releaseFunction);
    nextLock.resolve(releaseFunction);
  }

  private getNextLockToRun(): WaitingLockEntry | undefined {
    let lockTask: WaitingLockEntry | undefined;
    switch (this.options.queueType) {
      case "FIFO":
        lockTask = this.waitingQueue.shift();
        break;
      case "LIFO":
        lockTask = this.waitingQueue.pop();
        break;
    }

    return lockTask;
  }

  private sanitizeOptions(options: PoolLockOptions | undefined): Required<PoolLockOptions> {
    if (options === null || options === undefined || Array.isArray(options) || typeof options !== "object") {
      return defaultOptions;
    }

    const sanitizedOptions: any = { ...defaultOptions };

    for (const key in defaultOptions) {
      const typedKey = key as keyof PoolLockOptions;

      const defaultValue = defaultOptions[typedKey];
      const value = options[typedKey] as any;
      if (value === null || value === undefined) {
        continue;
      }

      const defaultValueType = typeof defaultValue;
      const valueType = typeof value;
      if (defaultValueType !== valueType) {
        continue;
      }

      sanitizedOptions[typedKey] = value;
    }

    return sanitizedOptions as Required<PoolLockOptions>;
  }
}
