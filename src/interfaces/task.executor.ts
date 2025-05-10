import { TaskEvent, TryRunResponse } from "../task-executors/promise-pool";
import { TaskOptions } from "../types/promise-options.type";
import { TaskEntry } from "./task-entry";

export interface TaskExecutor<T> {
  run<T>(task: () => Promise<T>, options?: TaskOptions): Promise<PromiseSettledResult<T>>;
  runMany<T>(tasks: Array<() => Promise<T>>, options?: TaskOptions): Promise<PromiseSettledResult<T>[]>;
  tryRun<T>(task: () => Promise<T>, options?: TaskOptions): TryRunResponse<T>;
  releaseRunningTasks(): void;
  flushPendingTasks(): void;
  on(event: TaskEvent, listener: (taskEntry: TaskEntry, ...args: any[]) => void): TaskExecutor<T>;
  off(event: TaskEvent, listener: (taskEntry: TaskEntry, ...args: any[]) => void): TaskExecutor<T>;
  isRunningLimitReached(): boolean;
  changeConcurrentLimit(newConcurrentLimit: number): void;
}
