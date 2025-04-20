import { QueueType } from "../types/queue.type";
import { PoolTaskExecutor, PoolTaskExecutorOptions } from "./pool-task-executor";

export type MutexTaskExecutorOptions = { queueType?: QueueType };

export class MutexTaskExecutor {
  private readonly poolTaskExecutor: PoolTaskExecutor;

  constructor(options?: MutexTaskExecutorOptions){
    if(!options){
      options = {};
    }

    this.poolTaskExecutor = new PoolTaskExecutor({...options, concurrent: 1} as PoolTaskExecutorOptions);
  }

  public async run<T>(task: () => Promise<T>): Promise<T> {
    return await this.poolTaskExecutor.run(task);
  }

  public async runMany<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    return await this.poolTaskExecutor.runMany(tasks);
  }
}