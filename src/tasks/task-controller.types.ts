import { LockController } from "../locks/lock-controller";
import { QueueType } from "../locks/lock-controller.types";

/**
 * The function that represent a task.
 */
export type Task<T> = (...args: any[]) => Promise<T>;

/**
 * The type representing a task entry with its arguments, options, and completion status.
 */
export type TaskEntry = {
  args: any[];
  options?: TaskOptions | undefined;
  releaseReason?: ReleaseBeforeFinishReason;
  discardReason?: DiscardReason;
};

/**
 * The type of the options for configuring task behavior.
 */
export type TaskOptions = {
  releaseTimeout?: number;
  releaseTimeoutHandler?: TaskTimeoutHandler;
  waitingTimeout?: number;
  waitingTimeoutHandler?: TaskTimeoutHandler;
  errorHandler?: ErrorHandler;
  signal?: AbortSignal;
};

/**
 * The type of the options for the task controller.
 */
export type TaskControllerOptions = TaskOptions & { queueType?: QueueType; concurrency?: number };

/**
 * The type of the function to handle task timeouts.
 */
export type TaskTimeoutHandler = (taskEntry: TaskEntry) => void;

/**
 * The type of the function to handle task errors.
 */
export type ErrorHandler = (taskEntry: TaskEntry, error: any) => void;

/**
 * The type of the response for the tryRun function.
 */
export type TryRunResponse<T> = { available: true; run: () => Promise<PromiseSettledResult<T>> } | { available: false; run?: undefined };

/**
 * The events triggered by the task controller.
 */
export type TaskEvent = "error" | "task-started" | "task-finished" | "task-failure" | "task-released-before-finished" | "task-discarded";

/**
 * The error codes triggered by the task controller.
 */
export type TaskErrorCode = "waiting-timeout-handler-failure" | "release-timeout-handler-failure" | "error-handler-failure";

/**
 * The type of the error triggered by the task controller.
 */
export type TaskEventError = { code: TaskErrorCode; error: any };

/**
 * The reasons why a task was released before finishing.
 */
export type ReleaseBeforeFinishReason = "timeoutReached" | "forced";

/**
 * The reasons why a task was discarded.
 */
export type DiscardReason = "timeoutReached" | "forced" | "abortSignal";

/**
 * The type of the options for multi-step controllers.
 */
export type MultiStepControllerOptions<N extends AllowedLengths> = { stepConcurrencies: FixedLengthArray<number, N> };

/**
 * The type of the function for multi-step tasks that receive step locks as parameters.
 */
export type MultiStepTask<T, N extends AllowedLengths> = (stepLocks: FixedLengthArray<LockController, N>, ...args: any[]) => Promise<T>;

export type AllowedLengths = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

export type FixedLengthArray<T, N extends AllowedLengths> =
  N extends 2 ? [T, T] :
  N extends 3 ? [T, T, T] :
  N extends 4 ? [T, T, T, T] :
  N extends 5 ? [T, T, T, T, T] :
  N extends 6 ? [T, T, T, T, T, T] :
  N extends 7 ? [T, T, T, T, T, T, T] :
  N extends 8 ? [T, T, T, T, T, T, T, T] :
  N extends 9 ? [T, T, T, T, T, T, T, T, T] :
  N extends 10 ? [T, T, T, T, T, T, T, T, T, T] :
  N extends 11 ? [T, T, T, T, T, T, T, T, T, T, T] :
  N extends 12 ? [T, T, T, T, T, T, T, T, T, T, T, T] :
  N extends 13 ? [T, T, T, T, T, T, T, T, T, T, T, T, T] :
  N extends 14 ? [T, T, T, T, T, T, T, T, T, T, T, T, T, T] :
  N extends 15 ? [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T] :
  N extends 16 ? [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T] :
  N extends 17 ? [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T] :
  N extends 18 ? [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T] :
  N extends 19 ? [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T] :
  [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T];
