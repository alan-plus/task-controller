import { ReleaseFunction } from "../types/release-function.type";

export interface WaitingLockEntry {
  resolve(result: ReleaseFunction): void;
  reject(reason?: any): void;
}

export interface RunningLockEntry {
  releaseTimeoutId?: NodeJS.Timeout;
}
