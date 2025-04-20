import { ILock } from "./lock";

export interface WaitingLockEntry extends RunningLockEntry { 
  resolve(result: ILock): void;
  reject(reason?: any): void;
};

export interface RunningLockEntry { };