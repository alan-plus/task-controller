import { TryAcquireResponse } from "../locks/lock-pool";
import { ReleaseFunction } from "./release-function";

export interface Lock {
  acquire(): Promise<ReleaseFunction>;
  tryAcquire(): TryAcquireResponse;
  locked(): boolean;
  releaseAll(): void;
}
