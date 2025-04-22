import { TaskExecutor } from "../interfaces/task.executor";
import { QueueType } from "../types/queue.type";
import { PromisePool, PromisePoolOptions } from "./promise-pool";

export type PromiseMutexOptions = { queueType?: QueueType };

export class PromiseMutex<T> implements TaskExecutor<T>{
  private readonly poolTaskExecutor: PromisePool<T>;

  constructor(options?: PromiseMutexOptions) {
    if (!options) {
      options = {};
    }

    this.poolTaskExecutor = new PromisePool({ ...options, concurrentLimit: 1 } as PromisePoolOptions);
  }

  public async run<T>(task: () => Promise<T>): Promise<T> {
    return await this.poolTaskExecutor.run(task);
  }

  public async runMany<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    return await this.poolTaskExecutor.runMany(tasks);
  }
}