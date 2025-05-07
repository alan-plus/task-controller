import { DiscardReason, ReleaseBeforeFinishReason, TaskExecutorReleaseFunction } from "../task-executors/promise-pool";
import { TaskOptions } from "../types/promise-options.type";

export interface TaskEntry {
  options?: TaskOptions | undefined;
  releaseReason?: ReleaseBeforeFinishReason;
  discardReason?: DiscardReason;
}

export interface WaitingTask extends TaskEntry {
  resolve(result: TaskExecutorReleaseFunction): void;
  reject(reason?: any): void;
  waitingTimeoutId?: NodeJS.Timeout;
}

export interface RunningTask extends TaskEntry {
  releaseTimeoutId?: NodeJS.Timeout;
}
