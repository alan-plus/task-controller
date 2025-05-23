import { TaskExecutorMutexOptions, TaskExecutorPoolOptions } from "../types/task-executor.type";
import { TaskExecutorPool } from "./task-executor-pool";

export class TaskExecutorMutex<T> extends TaskExecutorPool<T> {
  constructor(options?: TaskExecutorMutexOptions) {
    if (!options) {
      options = {};
    }

    super({ ...options, concurrentLimit: 1 } satisfies TaskExecutorPoolOptions);
  }

  public override changeConcurrentLimit(newConcurrentLimit: number): void {
    return;
  }
}
