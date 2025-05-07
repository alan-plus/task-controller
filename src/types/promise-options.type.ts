import { ErrorHandler } from "../task-executors/promise-mutex";
import { QueueType } from "./queue.type";
import { TimeoutHandler } from "./timeout-handler.type";

export type TaskOptions = {
  releaseTimeout?: number;
  releaseTimeoutHandler?: TimeoutHandler;
  waitingTimeout?: number;
  waitingTimeoutHandler?: TimeoutHandler;
  errorHandler?: ErrorHandler;
  signal?: AbortSignal;
};

export type PromiseMutexOptions = TaskOptions & { queueType?: QueueType; };

export type PromisePoolOptions = PromiseMutexOptions & { concurrentLimit?: number; };