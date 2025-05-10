import { ErrorHandler } from "../task-executors/promise-mutex";
import { QueueType } from "./queue.type";
import { TaskTimeoutHandler } from "./task-timeout-handler.type";

export type TaskOptions = {
  releaseTimeout?: number;
  releaseTimeoutHandler?: TaskTimeoutHandler;
  waitingTimeout?: number;
  waitingTimeoutHandler?: TaskTimeoutHandler;
  errorHandler?: ErrorHandler;
  signal?: AbortSignal;
};

export type PromiseMutexOptions = TaskOptions & { queueType?: QueueType; };

export type PromisePoolOptions = PromiseMutexOptions & { concurrentLimit?: number; };