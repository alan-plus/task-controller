import { ReleaseFunction } from "./release-function";

export interface WaitingLockEntry {
  resolve(result: ReleaseFunction): void;
  reject(reason?: any): void;
}

export interface RunningLockEntry {
  releaseTimeoutId?: NodeJS.Timeout;
}
