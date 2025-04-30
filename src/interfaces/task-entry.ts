import { ReleaseFunction } from "./release-function";

export interface TaskEntry {
  resolve(result: ReleaseFunction): void;
  reject(reason?: any): void;
  releaseTimeoutId?: NodeJS.Timeout;
}
