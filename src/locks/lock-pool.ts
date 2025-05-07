import { EventEmitter } from "events";
import { Lock } from "../interfaces/lock";
import { RunningLock, WaitingLock } from "../interfaces/lock-entry";
import { ReleaseFunction } from "../interfaces/release-function";
import { LockOptions } from "./lock-mutex";

export type TryAcquireResponse = { acquired: boolean; release?: ReleaseFunction };
export type LockEvent = "error" | "lock-acquire" | "lock-release";
export type LockErrorCode = "timeout-handler-error";
export type LockEventError = { code: LockErrorCode; error: any };
export type PoolLockOptions = LockOptions & { concurrentLimit?: number };

interface InternalReleaseFunction extends ReleaseFunction {
  (timeoutReached?: boolean): void;
}

const defaultOptions: Required<PoolLockOptions> = {
  concurrentLimit: 1,
  queueType: "FIFO",
  releaseTimeout: 0,
  timeoutHandler: () => {},
} satisfies PoolLockOptions;

export class LockPool extends EventEmitter implements Lock {
  private readonly options: Required<PoolLockOptions>;
  private readonly waitingQueue = new Array<WaitingLock>();
  private readonly runningQueue = new Map<RunningLock, ReleaseFunction>();

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

    const conncurrentLimitReached = this.runningQueue.size >= this.options.concurrentLimit;
    if (conncurrentLimitReached) {
      return { acquired: false };
    }

    const releaseFunction = this.start();

    return { acquired: true, release: releaseFunction };
  }

  public isLocked(): boolean {
    const conncurrentLimitReached = this.runningQueue.size >= this.options.concurrentLimit;
    return conncurrentLimitReached;
  }

  public releaseAll(): void {
    for (const [, releaseFunction] of this.runningQueue) {
      releaseFunction();
    }
  }

  private start(waitingLock?: WaitingLock): ReleaseFunction {
    const runningLock = {} as RunningLock;
    const releaseFunction = this.buildReleaseFunction(runningLock);
    this.runningQueue.set(runningLock, releaseFunction);
    this.emit("lock-acquire", runningLock);

    return releaseFunction;
  }

  private buildReleaseFunction(lockEntry: RunningLock): ReleaseFunction {
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
          this.options.timeoutHandler();
        } catch (error) {
          this.emit("error", { code: "timeout-handler-error", error } as LockEventError);
        }

        releaseFunction(true);
      }, this.options.releaseTimeout);
    }

    return releaseFunction;
  }

  private dispatchNextLock(): void {
    if (this.isLocked()) {
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
