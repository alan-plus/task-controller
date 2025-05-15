import { TryAcquireResponse, LockEvent } from "../types/lock.type";

export interface Lock {
  /**
   * Acquire the lock
   *
   * @returns Fulfills with a {ReleaseFunction} function once the lock is acquire.
   */
  acquire(): Promise<ReleaseFunction>;
  tryAcquire(): TryAcquireResponse;
  isLockLimitReached(): boolean;
  releaseAcquiredLocks(): void;
  on(event: LockEvent, listener: (...args: any[]) => void): Lock;
  off(event: LockEvent, listener: (...args: any[]) => void): Lock;
}

export interface WaitingLock {
  resolve(result: ReleaseFunction): void;
  reject(reason?: any): void;
}

export interface AcquiredLock {
  releaseTimeoutId?: NodeJS.Timeout;
}

export interface ReleaseFunction {
  (): void;
}
