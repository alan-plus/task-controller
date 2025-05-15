/**
 * The function to release the lock.\
 * **Important:** make sure to always call this function.
 */
export type ReleaseFunction = { (): void };
export type QueueType = "FIFO" | "LIFO";
export type TimeoutHandler = () => void;
export type LockOptions = { queueType?: QueueType; releaseTimeout?: number; releaseTimeoutHandler?: TimeoutHandler };
export type PoolLockOptions = LockOptions & { concurrentLimit?: number };
export type TryAcquireResponse = { acquired: true; release: ReleaseFunction } | { acquired: false; release?: undefined };
export type LockEvent = "error" | "lock-acquired" | "lock-released";
export type LockErrorCode = "release-timeout-handler-failure";
export type LockEventError = { code: LockErrorCode; error: any };
