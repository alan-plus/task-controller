import { LockController } from "../locks/lock-controller";
import { QueueType } from "../locks/lock-controller.type";

export type TaskEntry = {
  args: any[];
  options?: TaskOptions | undefined;
  releaseReason?: ReleaseBeforeFinishReason;
  discardReason?: DiscardReason;
};

export type TaskOptions = {
  releaseTimeout?: number;
  releaseTimeoutHandler?: TaskTimeoutHandler;
  waitingTimeout?: number;
  waitingTimeoutHandler?: TaskTimeoutHandler;
  errorHandler?: ErrorHandler;
  signal?: AbortSignal;
};

export type TaskControllerOptions = TaskOptions & { queueType?: QueueType, concurrency?: number };

export type TaskTimeoutHandler = (taskEntry: TaskEntry) => void;
export type ErrorHandler = (taskEntry: TaskEntry, error: any) => void;

export type TryRunResponse<T> = { available: true; run: () => Promise<PromiseSettledResult<T>> } | { available: false; run?: undefined };
export type TaskEvent = "error" | "task-started" | "task-finished" | "task-failure" | "task-released-before-finished" | "task-discarded";
export type TaskErrorCode = "waiting-timeout-handler-failure" | "release-timeout-handler-failure" | "error-handler-failure";
export type TaskEventError = { code: TaskErrorCode; error: any };

export type ReleaseBeforeFinishReason = "timeoutReached" | "forced";
export type DiscardReason = "timeoutReached" | "forced" | "abortSignal";

export type MultiStepControllerOptions = { stepConcurrencies: number[] };
export type MultiStepTask<T> = (...stepLocks: LockController[]) => Promise<T>;
