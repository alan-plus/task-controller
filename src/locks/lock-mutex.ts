import { QueueType } from "../types/queue.type";
import { TimeoutHandler } from "../types/timeout-handler.type";
import { LockPool, PoolLockOptions } from "./lock-pool";

export type LockOptions = { queueType?: QueueType; releaseTimeout?: number; releaseTimeoutHandler?: TimeoutHandler };

export class LockMutex extends LockPool {
  constructor(options?: LockOptions) {
    if (!options) {
      options = {};
    }

    super({ ...options, concurrentLimit: 1 } satisfies PoolLockOptions);
  }
}
