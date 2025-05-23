import { LockPool } from "./lock-pool";
import { LockOptions, LockPoolOptions } from "../types/lock.type";

/**
 * The LockMutex class can be used to prevent concurrent access to a resource.
 * ```js
 * import { LockMutex } from "tasktly";
 *
 * const lock = new LockMutex();
 *
 * async function sample () {
 *   const release = await lock.acquire();
 *   try {
 *     // access the resource protected by this lock
 *   } finally {
 *     // IMPORTANT: Make sure to always call the `release` function.
 *     release();
 *   }
 * }
 * ```
 * @since v1.0.0
 * @see [source](https://github.com/alan-plus/tasktly/blob/v1.0.0/src/locks/lock-mutex.ts)
 */
export class LockMutex extends LockPool {
  /**
   * Creates a new LockMutex instance.
   * @param options {LockOptions}.
   */
  constructor(options?: LockOptions) {
    if (!options) {
      options = {};
    }

    super({ ...options, concurrentLimit: 1 } satisfies LockPoolOptions);
  }
}
