import { AcquireResponse, DiscardReason, ReleaseBeforeFinishReason } from "../task-executors/promise-pool";
import { TaskOptions } from "../types/promise-options.type";

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
