import { PoolLock } from "../locks/pool-lock";
import { ILock } from "../interfaces/lock";

export type MultiStepTaskExecutorOptions = { lockerConcurrent: number[]};

type MultiStepTask<T> = (...stepLockers: ILock[]) => Promise<T>;

export class MultiStepTaskExecutor {
  private readonly options: Required<MultiStepTaskExecutorOptions>;
  private readonly locks = new Array<ILock>();

  constructor(options: MultiStepTaskExecutorOptions){
    this.options = options;
    this.options.lockerConcurrent.forEach((concurrent)=>{  this.locks.push(new PoolLock({concurrent}))});
  }

  public async run<T>(task: MultiStepTask<T>): Promise<T> {
    return await task(...this.locks);
  }

  public async runMany<T>(tasks: Array<MultiStepTask<T>>): Promise<T[]> {
    const promises = tasks.map(async (task) => {
      return task(...this.locks);
    });

    return Promise.all(promises);    
  }
}