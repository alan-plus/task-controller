import { ReleaseFunction } from "../types/release-function.type";
import { TaskEntry } from "../interfaces/task-entry";
import { MutexTaskExecutorOptions } from "./mutex-task-executor";

export type PoolTaskExecutorOptions = MutexTaskExecutorOptions & { concurrent?: number};

const defaultOptions: Required<PoolTaskExecutorOptions> = { concurrent: 1, queueType: 'FIFO' };

export class PoolTaskExecutor {
  private readonly options: Required<PoolTaskExecutorOptions>;

  private readonly waitingQueue = new Array<TaskEntry>();
  private readonly runningQueue = new Set<TaskEntry>();
  private readonly expiredQueue = new Array<TaskEntry>();

  constructor(options?: PoolTaskExecutorOptions){
    this.options = this.sanitizeOptions(options, defaultOptions);
  }

  public async run<T>(task: () => Promise<T>): Promise<T> {
    return await this.enqueueAndRun(task);
  }

  public async runMany<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    const results = new Array<T>();
    
    tasks.forEach(async (task) => {
      results.push(await this.enqueueAndRun(task));
    });
    
    return results;
  }

  private async acquire(): Promise<ReleaseFunction> {
    return new Promise<ReleaseFunction>((resolve, reject) => {
      const taskEntry = { resolve, reject } as TaskEntry;
      this.waitingQueue.push(taskEntry);
      this.dispatchNextTask();
    });
  }

  private async enqueueAndRun<T>(task: () => Promise<T>): Promise<T> {
    const releaseSlot = await this.acquire();
    try {
      return await task();
    } finally {
      releaseSlot();
    }
  }

  private dispatchNextTask(): void {
    const conncurrentLimitReached = this.runningQueue.size >= this.options.concurrent;
    if (conncurrentLimitReached) {
      return;
    }

    const nextTask = this.getNextTaskToRun();
    if (!nextTask) {
      return;
    }

    this.runningQueue.add(nextTask);
    const releaseFunction = this.buildReleaseFunction(nextTask);
    nextTask.resolve(releaseFunction);
  }

  private buildReleaseFunction(taskEntry: TaskEntry): ReleaseFunction {
    return () => {
      this.runningQueue.delete(taskEntry);
      this.dispatchNextTask();
    };
  }

  private getNextTaskToRun(): TaskEntry | undefined {
    let nextTask: TaskEntry | undefined;
    switch(this.options.queueType){
      case 'FIFO':
        nextTask = this.waitingQueue.shift();
        break;
      case 'LIFO':
        nextTask =  this.waitingQueue.pop();
        break;
      default:
        nextTask =  this.waitingQueue.shift();
    }

    return nextTask;
  }

  private sanitizeOptions(options: PoolTaskExecutorOptions | undefined, 
    defaultOptions: Required<PoolTaskExecutorOptions>): Required<PoolTaskExecutorOptions> {

    if(options === null || options === undefined || Array.isArray(options) || typeof options !== 'object'){
      return defaultOptions;
    }

    const sanitizedOptions: PoolTaskExecutorOptions = {...defaultOptions};

    for(const key in defaultOptions){
      const typedKey = key as keyof PoolTaskExecutorOptions;

      const defaultValue = defaultOptions[typedKey];
      const value = options[typedKey] as any;
      if(value === null || value === undefined){
        continue;
      }

      const defaultValueType = typeof defaultValue;
      const valueType = typeof value;
      if(defaultValueType !== valueType){
        continue;
      }

      sanitizedOptions[typedKey] = value;
    }

    return sanitizedOptions as Required<PoolTaskExecutorOptions>;
  }
}