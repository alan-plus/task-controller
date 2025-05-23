import { TryAcquireResponse, LockEvent, ReleaseFunction } from "../types/lock.type";

/**
 * Lock interface
 */
export interface ILock {
  /**
   * Acquires the lock
   *
   * @returns Fulfills with a {ReleaseFunction} function once the lock is acquire.
   */
  acquire(): Promise<ReleaseFunction>;

  /**
   * Acquires the lock only if one is available at the time of invocation.
   *
   * @returns {TryAcquireResponse}
   */
  tryAcquire(): TryAcquireResponse;

  /**
   * Indicates if the lock is currently available
   *
   */
  isAvailable(): boolean;

  /**
   * Force the release of all the acquired locks
   */
  releaseAcquiredLocks(): void;

  /**
   * Adds the `listener` function to the end of the listeners array for the event
   *
   * @param event a {LockEvent}
   * @param listener The callback function
   */
  on(event: LockEvent, listener: (...args: any[]) => void): ILock;

  /**
   * Removes the specified `listener` from the listener array for the event.
   *
   * @param event a {LockEvent}
   * @param listener The callback function
   */
  off(event: LockEvent, listener: (...args: any[]) => void): ILock;
}
