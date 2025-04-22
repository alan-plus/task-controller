import { Lock } from "../interfaces/lock";
import { QueueType } from "../types/queue.type";
import { LockPool, PoolLockOptions } from "./lock-pool";

export type LockOptions = { queueType?: QueueType };

export class LockMutex implements Lock {
  private readonly poolLock: LockPool;

  constructor(options?: LockOptions) {
    if (!options) {
      options = {};
    }

    this.poolLock = new LockPool({ ...options, concurrent: 1 } as PoolLockOptions);
  }

  public async lock(): Promise<Lock> {
    return await this.poolLock.lock();
  }

  public tryLock(): boolean {
    return this.poolLock.tryLock();
  }

  public unlock(): void {
    this.poolLock.unlock();
  }

  public locked(): boolean {
    return this.poolLock.locked();
  }
}
