import { EventEmitter } from "events";
import { LockEvent, LockEventError, LockControllerOptions, ReleaseFunction, TryAcquireResponse } from "./lock-controller.type";
import { OptionsSanitizerUtils } from "../utils/options-sanitizer.utils";

type InternalReleaseFunction = ReleaseFunction & { (timeoutReached?: boolean): void };
type WaitingLock = {
  resolve(result: ReleaseFunction): void;
  reject(reason?: any): void;
};
type AcquiredLock = { releaseTimeoutId?: NodeJS.Timeout };

const defaultOptions: Required<LockControllerOptions> = {
  concurrency: 1,
  queueType: "FIFO",
  releaseTimeout: 0,
  releaseTimeoutHandler: () => {},
} satisfies LockControllerOptions;

/**
 * The LockController class can be used to allow limited concurrent access to a resource.
 * ```js
 * import { LockController } from "task-controller";
 *
 *   // concurrent access to the resource limited to 2
 *   const lock = new LockController({ concurrentLimit: 2 });
 *
 *   await Promise.all([
 *
 *     // Task 1 (will access the resource immediately)
 *     new Promise<any>(async (resolve) => {
 *       const release = await lock.acquire();
 *       try {
 *         // access the protected resource
 *         resolve();
 *       } finally {
 *         release();
 *       }
 *     }),
 *
 *     // Task 2 (will access the resource immediately)
 *     new Promise<any>(async (resolve) => {
 *       const release = await lock.acquire();
 *       try {
 *         // access the protected resource
 *         resolve();
 *       } finally {
 *         release();
 *       }
 *     }),
 *
 *     // Task 3 (will access the resource once 'Task 1' or 'Task 2' is completed)
 *     new Promise<any>(async (resolve) => {
 *       const release = await lock.acquire();
 *       try {
 *         // access the protected resource
 *         resolve();
 *       } finally {
 *         release();
 *       }
 *     }),
 *   ]);
 * ```
 * @since v1.0.0
 * @see [source](https://github.com/alan-plus/tasktly/blob/v1.0.0/src/locks/lock-pool.ts)
 */
export class LockController {
  private readonly options: Required<LockControllerOptions>;
  private readonly waitingQueue = new Array<WaitingLock>();
  private readonly acquiredQueue = new Map<AcquiredLock, ReleaseFunction>();
  private readonly internalEmitter = new EventEmitter();

  /**
   * Creates a new LockController instance.
   * @param options {LockControllerOptions}.
   */
  constructor(options?: LockControllerOptions) {
    this.options = this.sanitizeOptions(options);
  }

  /**
   * Adds the `listener` function to the end of the listeners array for the event
   *
   * @param event a {LockEvent}
   * @param listener The callback function
   */
  public on(event: LockEvent, listener: (...args: any[]) => void): this {
    this.internalEmitter.on(event, listener);
    return this;
  }

  /**
   * Removes the specified `listener` from the listener array for the event.
   *
   * @param event a {LockEvent}
   * @param listener The callback function
   */
  public off(event: LockEvent, listener: (...args: any[]) => void): this {
    this.internalEmitter.off(event, listener);
    return this;
  }

  /**
   * Acquires the lock
   *
   * @returns Fulfills with a {ReleaseFunction} function once the lock is acquire.
   */
  public async acquire(): Promise<ReleaseFunction> {
    return new Promise<ReleaseFunction>((resolve, reject) => {
      const lockEntry = { resolve, reject } satisfies WaitingLock;
      this.waitingQueue.push(lockEntry);
      this.dispatchNextLock();
    });
  }

  /**
   * Acquires the lock only if one is available at the time of invocation.
   *
   * @returns {TryAcquireResponse}
   */
  public tryAcquire(): TryAcquireResponse {
    const someOneIsWaitingTheLock = this.waitingQueue.length > 0;
    if (someOneIsWaitingTheLock) {
      return { acquired: false };
    }

    const conncurrentLimitReached = this.acquiredQueue.size >= this.options.concurrency;
    if (conncurrentLimitReached) {
      return { acquired: false };
    }

    const releaseFunction = this.start();

    return { acquired: true, release: releaseFunction };
  }

  /**
   * Indicates if the lock is currently available
   *
   */
  public isAvailable(): boolean {
    const conncurrentLimitReached = this.acquiredQueue.size >= this.options.concurrency;
    return !conncurrentLimitReached;
  }

  /**
   * Force the release of all the acquired locks
   */
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
    if (!this.isAvailable()) {
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

  private sanitizeOptions(options?: LockControllerOptions): Required<LockControllerOptions> {
    if (options) {
      const sanitizedConcurrentLimit = OptionsSanitizerUtils.sanitizeNumberToPositiveGraterThanZeroInteger(options.concurrency);
      if (sanitizedConcurrentLimit === undefined) {
        delete options.concurrency;
      } else {
        options.concurrency = sanitizedConcurrentLimit;
      }
    }

    return OptionsSanitizerUtils.sanitizeToRequired(options, defaultOptions);
  }
}
