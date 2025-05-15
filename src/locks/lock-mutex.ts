import { LockPool } from "./lock-pool";
import { LockOptions, PoolLockOptions } from "../types/lock.type";

export class LockMutex extends LockPool {
  constructor(options?: LockOptions) {
    if (!options) {
      options = {};
    }

    super({ ...options, concurrentLimit: 1 } satisfies PoolLockOptions);
  }
}
