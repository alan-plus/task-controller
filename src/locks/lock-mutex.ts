import { QueueType } from "../types/queue.type";
import { LockPool, PoolLockOptions } from "./lock-pool";

export type LockOptions = { queueType?: QueueType; releaseTimeout?: number; releaseTimeoutCallback?: () => void };

export class LockMutex extends LockPool {
  constructor(options?: LockOptions) {
    if (!options) {
      options = {};
    }

    super({ ...options, concurrentLimit: 1 } satisfies PoolLockOptions);
  }
}
