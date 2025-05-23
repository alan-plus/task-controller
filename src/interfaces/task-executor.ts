import { TaskEntry, TaskEvent, TaskOptions, TryRunResponse } from "../types/task-executor.type";

export interface TaskExecutor<T> {
  run<T>(task: (arg?: any) => Promise<T>, arg?: any, options?: TaskOptions): Promise<PromiseSettledResult<T>>;
  runMany<T>(tasks: Array<(arg?: any) => Promise<T>>, args?: any[], options?: TaskOptions): Promise<PromiseSettledResult<T>[]>;
  tryRun<T>(task: (arg?: any) => Promise<T>, arg?: any, options?: TaskOptions): TryRunResponse<T>;
  releaseRunningTasks(): void;
  flushPendingTasks(): void;
  on(event: TaskEvent, listener: (taskEntry: TaskEntry, ...args: any[]) => void): TaskExecutor<T>;
  off(event: TaskEvent, listener: (taskEntry: TaskEntry, ...args: any[]) => void): TaskExecutor<T>;
  isAvailable(): boolean;
  changeConcurrentLimit(newConcurrentLimit: number): void;
  waitingTasks(): number;
  runningTasks(): number;
  expiredTasks(): number;
}
