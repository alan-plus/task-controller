import { ReleaseFunction } from "../interfaces/lock";

export type QueueType = "FIFO" | "LIFO";
export type TimeoutHandler = () => void;
export type LockOptions = { queueType?: QueueType; releaseTimeout?: number; releaseTimeoutHandler?: TimeoutHandler };
export type PoolLockOptions = LockOptions & { concurrentLimit?: number };
export type TryAcquireResponse = { acquired: boolean; release?: ReleaseFunction };
export type LockEvent = "error" | "lock-acquired" | "lock-released";
export type LockErrorCode = "release-timeout-handler-failure";
export type LockEventError = { code: LockErrorCode; error: any };