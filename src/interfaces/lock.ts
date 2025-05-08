import { LockEvent, TryAcquireResponse } from "../locks/lock-pool";
import { ReleaseFunction } from "./release-function";

export interface Lock {
  acquire(): Promise<ReleaseFunction>;
  tryAcquire(): TryAcquireResponse;
  isLocked(): boolean;
  releaseRunningLocks(): void;
  on(event: LockEvent, listener: () => void): Lock;
  off(event: LockEvent, listener: () => void): Lock;
}
