import { TryRunResponse } from "../task-executors/promise-pool";
import { TaskOptions } from "../types/promise-options.type";

export interface TaskExecutor<T> {
  run<T>(task: () => Promise<T>, options?: TaskOptions): Promise<PromiseSettledResult<T>>;
  runMany<T>(tasks: Array<() => Promise<T>>, options?: TaskOptions): Promise<PromiseSettledResult<T>[]>;
  tryRun<T>(task: () => Promise<T>, options?: TaskOptions): TryRunResponse<T>;
  releaseAll(): void;
  flushPendingTasks(): void;
}
