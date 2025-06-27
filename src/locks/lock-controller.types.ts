/**
 * The type of the function to release the lock.\
 * **Important:** make sure to always call this function.
 */
export type ReleaseFunction = { (): void };

/**
 * The type of the queue to use for the lock controller.
 */
export type QueueType = "FIFO" | "LIFO";

/**
 * The type of the function to handle the timeout for the lock controller.
 */
export type TimeoutHandler = () => void;

/**
 * The type of the options for the lock controller.
 */
export type LockControllerOptions = {
  queueType?: QueueType;
  releaseTimeout?: number;
  releaseTimeoutHandler?: TimeoutHandler;
  concurrency?: number;
};

/**
 * The type of the response for the tryAcquire function.
 */
export type TryAcquireResponse = { acquired: true; release: ReleaseFunction } | { acquired: false; release?: undefined };

/**
 * The events triggered by the lock controller.
 */
export type LockEvent = "error" | "lock-acquired" | "lock-released";

/**
 * The error codes triggered by the lock controller.
 */
export type LockErrorCode = "release-timeout-handler-failure";

/**
 * The type of the error triggered by the lock controller.
 */
export type LockEventError = { code: LockErrorCode; error: any };
