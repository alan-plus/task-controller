import { Lock } from "../interfaces/lock";

export type PromiseMultiStepOptions = { stepConcurrentLimits: number[] };
export type MultiStepTask<T> = (...stepLocks: Lock[]) => Promise<T>;