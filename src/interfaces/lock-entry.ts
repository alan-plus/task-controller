import { ReleaseFunction } from "./release-function";

export interface WaitingLock {
  resolve(result: ReleaseFunction): void;
  reject(reason?: any): void;
}

export interface AcquiredLock {
  releaseTimeoutId?: NodeJS.Timeout;
}
