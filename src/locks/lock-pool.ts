import { EventEmitter } from "events";
import { Lock } from "../interfaces/lock";
import { RunningLockEntry, WaitingLockEntry } from "../interfaces/lock-entry";
import { ReleaseFunction } from "../interfaces/release-function";
import { LockOptions } from "./lock-mutex";

// abortSignal at timeout: send abort signal if release timeout is reached. AbortController is received when lock is acquired
// errorHandler is not needed on lock, but is needed on taskExecutor
export type TryAcquireResponse = { acquired: boolean; release?: ReleaseFunction };
export type LockEvent = "error" | "lock-acquire" | "lock-release";
export type LockErrorCode = "release-timeout-callback-error";
export type LockEventError = { code: LockErrorCode; error: any };
export type PoolLockOptions = LockOptions & { concurrentLimit?: number };

interface InternalReleaseFunction extends ReleaseFunction {
  (timeoutReached?: boolean): void;
}

const defaultOptions: Required<PoolLockOptions> = { concurrentLimit: 1, queueType: "FIFO", releaseTimeout: 0, releaseTimeoutCallback: () => {} };

export class LockPool extends EventEmitter implements Lock {
  private readonly options: Required<PoolLockOptions>;
  private readonly waitingQueue = new Array<WaitingLockEntry>();
  private readonly runningQueue = new Map<RunningLockEntry, ReleaseFunction>();

  constructor(options?: PoolLockOptions) {
    super();
    this.options = this.sanitizeOptions(options);
  }

  public override on(event: LockEvent, listener: () => void): this {
    return super.on(event, listener);
  }

  public override emit(event: LockEvent, ...args: any[]): boolean {
    return super.emit(event, ...args);
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

    const releaseFunction = this.acquireLock();

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

  private acquireLock(waitingLock?: WaitingLockEntry): ReleaseFunction {
    const lockEntry = {} as RunningLockEntry;
    const releaseFunction = this.buildReleaseFunction(lockEntry);
    this.runningQueue.set(lockEntry, releaseFunction);
    this.emit("lock-acquire", lockEntry);

    return releaseFunction;
  }

  private buildReleaseFunction(lockEntry: RunningLockEntry): ReleaseFunction {
    const releaseFunction: InternalReleaseFunction = (timeoutReached: boolean = false) => {
      if (!this.runningQueue.has(lockEntry)) {
        return;
      }

      if (lockEntry.releaseTimeoutId) {
        clearTimeout(lockEntry.releaseTimeoutId);
      }

      this.runningQueue.delete(lockEntry);
      this.emit("lock-release", lockEntry, timeoutReached);
      this.dispatchNextLock();
    };

    if (this.options.releaseTimeout > 0) {
      lockEntry.releaseTimeoutId = setTimeout(() => {
        try {
          this.options.releaseTimeoutCallback();
        } catch (error) {
          this.emit("error", { code: "release-timeout-callback-error", error } as LockEventError);
        }

        releaseFunction(true);
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

    const releaseFunction = this.acquireLock(nextLock);

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
