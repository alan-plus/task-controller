import { ReleaseFunction } from "../types/release-function.type";

export interface TaskEntry {
  resolve(result: ReleaseFunction): void;
  reject(reason?: any): void;
  releaseTimeoutId?: NodeJS.Timeout;
};