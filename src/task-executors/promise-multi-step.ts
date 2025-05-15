import { LockPool } from "../locks/lock-pool";
import { ILock } from "../interfaces/lock";
import { PromiseMultiStepOptions, MultiStepTask } from "../types/task-executor.type";

export class PromiseMultiStep<T> {
  private readonly options: Required<PromiseMultiStepOptions>;
  private readonly stepLocks = new Array<ILock>();

  constructor(options: PromiseMultiStepOptions) {
    this.options = options;
    this.options.stepConcurrentLimits.forEach((concurrentLimit) => {
      this.stepLocks.push(new LockPool({ concurrentLimit }));
    });
  }

  public async run<T>(task: MultiStepTask<T>): Promise<T> {
    return await task(...this.stepLocks);
  }

  public async runMany<T>(tasks: Array<MultiStepTask<T>>): Promise<T[]> {
    const promises = tasks.map((task) => task(...this.stepLocks));

    return Promise.all(promises);
  }

  public releaseAll(): void {
    for (const lock of this.stepLocks) {
      lock.releaseAcquiredLocks();
    }
  }

  public isStepLockLimitReached(stepIndex: number): boolean {
    const stepLock = this.stepLocks[stepIndex];
    if (!stepLock) {
      return false;
    }

    return !stepLock.isAvailable();
  }
}
