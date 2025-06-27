import { LockController } from "../locks/lock-controller";
import { AllowedLengths, FixedLengthArray, MultiStepControllerOptions, MultiStepTask } from "./task-controller.types";

export class MultiStepController<T, N extends AllowedLengths> {
  private readonly options: Required<MultiStepControllerOptions<N>>;
  private readonly stepLocks;

  constructor(options: MultiStepControllerOptions<N>) {
    this.options = options;

    const _stepLocks = new Array<LockController>();
    this.options.stepConcurrencies.forEach((concurrentLimit) => {
      _stepLocks.push(new LockController({ concurrency: concurrentLimit }));
    });

    this.stepLocks = _stepLocks as FixedLengthArray<LockController, N>;
  }

  public async run(task: MultiStepTask<T, N>, ...args: any[]): Promise<T> {
    return await task(this.stepLocks, ...args);
  }

  public async runMany(tasks: { task: MultiStepTask<T, N>; args?: any[] }[]): Promise<T[]> {
    const promises = tasks.map((taskData) => {
      const { task, args } = taskData;

      if (args) {
        return task(this.stepLocks, ...args);
      } else {
        return task(this.stepLocks);
      }
    });

    return Promise.all(promises);
  }

  public async runForEachArgs(argsArray: any[][], task: MultiStepTask<T, N>): Promise<T[]> {
    const promises = argsArray.map((args) => {
      return task(this.stepLocks, ...args);
    });

    return Promise.all(promises);
  }

  public async runForEach<E>(entities: E[], task: (stepLocks: FixedLengthArray<LockController, N>, entity: E) => Promise<T>): Promise<T[]> {
    const promises = entities.map((entity) => {
      return task(this.stepLocks, entity);
    });

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
