import { Lock } from "../interfaces/lock";
import { QueueType } from "../types/queue.type";
import { ReleaseFunction } from "../types/release-function.type";
import { LockPool, PoolLockOptions, TryAcquireResponse } from "./lock-pool";

export type LockOptions = { queueType?: QueueType; releaseTimeout?: number };

export class LockMutex implements Lock {
  private readonly poolLock: LockPool;

  constructor(options?: LockOptions) {
    if (!options) {
      options = {};
    }

    this.poolLock = new LockPool({ ...options, concurrentLimit: 1 } satisfies PoolLockOptions);
  }

  public async acquire(): Promise<ReleaseFunction> {
    return await this.poolLock.acquire();
  }

  public tryAcquire(): TryAcquireResponse {
    return this.poolLock.tryAcquire();
  }

  public locked(): boolean {
    return this.poolLock.locked();
  }

  public releaseAll(): void {
    this.poolLock.releaseAll();
  }
}
