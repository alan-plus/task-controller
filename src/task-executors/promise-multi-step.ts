import { LockPool } from "../locks/lock-pool";
import { Lock } from "../interfaces/lock";
import { TaskExecutor } from "../interfaces/task.executor";

export type PromiseMultiStepOptions = { stepConcurrentLimits: number[] };

type MultiStepTask<T> = (...stepLocks: Lock[]) => Promise<T>;

export class PromiseMultiStep<T> implements TaskExecutor<MultiStepTask<T>> {
  private readonly options: Required<PromiseMultiStepOptions>;
  private readonly stepLocks = new Array<Lock>();

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
}
