import { Lock } from "./lock";

export interface WaitingLockEntry extends RunningLockEntry {
  resolve(result: Lock): void;
  reject(reason?: any): void;
}

export interface RunningLockEntry {}
