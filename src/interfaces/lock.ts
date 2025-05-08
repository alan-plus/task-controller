import { LockEvent, TryAcquireResponse } from "../locks/lock-pool";
import { ReleaseFunction } from "./release-function";

export interface Lock {
  acquire(): Promise<ReleaseFunction>;
  tryAcquire(): TryAcquireResponse;
  isLockLimitReached(): boolean;
  releaseAcquiredLocks(): void;
  on(event: LockEvent, listener: (...args: any[]) => void): Lock;
  off(event: LockEvent, listener: (...args: any[]) => void): Lock;
}
