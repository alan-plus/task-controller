import { PromiseMutexOptions, PromisePoolOptions } from "../types/promise-options.type";
import { PromisePool } from "./promise-pool";

export class PromiseMutex<T> extends PromisePool<T> {
  constructor(options?: PromiseMutexOptions) {
    if (!options) {
      options = {};
    }

    super({ ...options, concurrentLimit: 1 } satisfies PromisePoolOptions);
  }

  public override changeConcurrentLimit(newConcurrentLimit: number): void {
    return;
  }
}
