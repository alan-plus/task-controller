import { EventEmitter } from "events";
import { AcquiredLock, Lock, ReleaseFunction, WaitingLock } from "../interfaces/lock";
import { LockEvent, LockEventError, PoolLockOptions, TryAcquireResponse } from "../types/lock.type";
import { OptionsSanitizerUtils } from "../utils/options-sanitizer.utils";

interface InternalReleaseFunction extends ReleaseFunction {
  (timeoutReached?: boolean): void;
}

const defaultOptions: Required<PoolLockOptions> = {
  concurrentLimit: 1,
  queueType: "FIFO",
  releaseTimeout: 0,
  releaseTimeoutHandler: () => {},
} satisfies PoolLockOptions;

export class LockPool implements Lock {
  private readonly options: Required<PoolLockOptions>;
  private readonly waitingQueue = new Array<WaitingLock>();
  private readonly acquiredQueue = new Map<AcquiredLock, ReleaseFunction>();
  private readonly internalEmitter = new EventEmitter();

  constructor(options?: PoolLockOptions) {
    this.options = this.sanitizeOptions(options);
  }

  public on(event: LockEvent, listener: (...args: any[]) => void): this {
    this.internalEmitter.on(event, listener);
    return this;
  }

  public off(event: LockEvent, listener: (...args: any[]) => void): this {
    this.internalEmitter.off(event, listener);
    return this;
  }

  public async acquire(): Promise<ReleaseFunction> {
    return new Promise<ReleaseFunction>((resolve, reject) => {
      const lockEntry = { resolve, reject } satisfies WaitingLock;
      this.waitingQueue.push(lockEntry);
      this.dispatchNextLock();
    });
  }

  public tryAcquire(): TryAcquireResponse {
    const someOneIsWaitingTheLock = this.waitingQueue.length > 0;
    if (someOneIsWaitingTheLock) {
      return { acquired: false };
    }

    const conncurrentLimitReached = this.acquiredQueue.size >= this.options.concurrentLimit;
    if (conncurrentLimitReached) {
      return { acquired: false };
    }

    const releaseFunction = this.start();

    return { acquired: true, release: releaseFunction };
  }

  public isLockLimitReached(): boolean {
    const conncurrentLimitReached = this.acquiredQueue.size >= this.options.concurrentLimit;
    return conncurrentLimitReached;
  }

  public releaseAcquiredLocks(): void {
    if (!this.acquiredQueue.size) {
      return;
    }

    const acquiredQueueCopy = [...this.acquiredQueue];
    for (const [, releaseFunction] of acquiredQueueCopy) {
      releaseFunction();
    }
  }

  private emit(event: LockEvent, ...args: any[]): boolean {
    return this.internalEmitter.emit(event, ...args);
  }

  private start(waitingLock?: WaitingLock): ReleaseFunction {
    const acquiredLock = {} as AcquiredLock;
    const releaseFunction = this.buildReleaseFunction(acquiredLock);
    this.acquiredQueue.set(acquiredLock, releaseFunction);
    this.emit("lock-acquired", acquiredLock);

    return releaseFunction;
  }

  private buildReleaseFunction(lockEntry: AcquiredLock): ReleaseFunction {
    const releaseFunction: InternalReleaseFunction = (timeoutReached: boolean = false) => {
      if (!this.acquiredQueue.has(lockEntry)) {
        return;
      }

      if (lockEntry.releaseTimeoutId) {
        clearTimeout(lockEntry.releaseTimeoutId);
      }

      this.acquiredQueue.delete(lockEntry);
      this.emit("lock-released", lockEntry, timeoutReached);
      this.dispatchNextLock();
    };

    if (this.options.releaseTimeout > 0) {
      lockEntry.releaseTimeoutId = setTimeout(() => {
        try {
          this.options.releaseTimeoutHandler();
        } catch (error) {
          this.emit("error", { code: "release-timeout-handler-failure", error } as LockEventError);
        }

        releaseFunction(true);
      }, this.options.releaseTimeout);
    }

    return releaseFunction;
  }

  private dispatchNextLock(): void {
    if (this.isLockLimitReached()) {
      return;
    }

    const nextLock = this.getNextLockToRun();
    if (!nextLock) {
      return;
    }

    const releaseFunction = this.start(nextLock);

    nextLock.resolve(releaseFunction);
  }

  private getNextLockToRun(): WaitingLock | undefined {
    let lockEntry: WaitingLock | undefined;
    switch (this.options.queueType) {
      case "FIFO":
        lockEntry = this.waitingQueue.shift();
        break;
      case "LIFO":
        lockEntry = this.waitingQueue.pop();
        break;
    }

    return lockEntry;
  }

  private sanitizeOptions(options?: PoolLockOptions): Required<PoolLockOptions> {
    if (options) {
      const sanitizedConcurrentLimit = OptionsSanitizerUtils.sanitizeNumberToPositiveGraterThanZeroInteger(options.concurrentLimit);
      if (sanitizedConcurrentLimit === undefined) {
        delete options.concurrentLimit;
      } else {
        options.concurrentLimit = sanitizedConcurrentLimit;
      }
    }

    return OptionsSanitizerUtils.sanitizeToRequired(options, defaultOptions);
  }
}
