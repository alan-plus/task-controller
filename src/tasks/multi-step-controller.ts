import { LockController } from "../locks/lock-controller";
import { MultiStepControllerOptions, MultiStepTask } from "./task-controller.types";

export class MultiStepController<T> {
  private readonly options: Required<MultiStepControllerOptions>;
  private readonly stepLocks = new Array<LockController>();

  constructor(options: MultiStepControllerOptions) {
    this.options = options;
    this.options.stepConcurrencies.forEach((concurrentLimit) => {
      this.stepLocks.push(new LockController({ concurrency: concurrentLimit }));
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
