import { TryAcquireResponse } from "../locks/lock-pool";
import { ReleaseFunction } from "../types/release-function.type";

export interface Lock {
  acquire(): Promise<ReleaseFunction>;
  tryAcquire(): TryAcquireResponse;
  locked(): boolean;
  releaseAll(): void;
}
