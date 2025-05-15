import { DiscardReason, ReleaseBeforeFinishReason, TaskEvent, TaskOptions, TryRunResponse } from "../types/promise-options.type";

export interface TaskExecutor<T> {
  run<T>(task: (arg?: any) => Promise<T>, arg?: any, options?: TaskOptions): Promise<PromiseSettledResult<T>>;
  runMany<T>(tasks: Array<(arg?: any) => Promise<T>>, args?: any[], options?: TaskOptions): Promise<PromiseSettledResult<T>[]>;
  tryRun<T>(task: (arg?: any) => Promise<T>, arg?: any, options?: TaskOptions): TryRunResponse<T>;
  releaseRunningTasks(): void;
  flushPendingTasks(): void;
  on(event: TaskEvent, listener: (taskEntry: TaskEntry, ...args: any[]) => void): TaskExecutor<T>;
  off(event: TaskEvent, listener: (taskEntry: TaskEntry, ...args: any[]) => void): TaskExecutor<T>;
  isRunningLimitReached(): boolean;
  changeConcurrentLimit(newConcurrentLimit: number): void;
  waitingTasks(): number;
  runningTasks(): number;
  expiredTasks(): number;
}

export interface TaskEntry {
  arg?: any | undefined;
  options?: TaskOptions | undefined;
  releaseReason?: ReleaseBeforeFinishReason;
  discardReason?: DiscardReason;
}

export interface WaitingTask extends TaskEntry {
  resolve(result: AcquireResponse): void;
  reject(reason?: any): void;
  waitingTimeoutId?: NodeJS.Timeout;
}

export interface RunningTask extends TaskEntry {
  releaseTimeoutId?: NodeJS.Timeout;
}

export interface TaskExecutorReleaseFunction {
  (reason?: ReleaseBeforeFinishReason): void;
}

export interface AcquireResponse {
  release: TaskExecutorReleaseFunction;
  taskEntry: TaskEntry;
}
