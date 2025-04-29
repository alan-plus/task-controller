import { ReleaseFunction } from "../types/release-function.type";
import { TaskEntry } from "../interfaces/task-entry";
import { PromiseMutexOptions } from "./promise-mutex";
import { TaskExecutor } from "../interfaces/task.executor";

export type PromisePoolOptions = PromiseMutexOptions & { concurrentLimit?: number };

const defaultOptions: Required<PromisePoolOptions> = { concurrentLimit: 1, queueType: "FIFO", releaseTimeout: 0 };

export class PromisePool<T> implements TaskExecutor<T> {
  private readonly options: Required<PromisePoolOptions>;

  private readonly waitingQueue = new Array<TaskEntry>();
  private readonly runningQueue = new Map<TaskEntry, ReleaseFunction>();
  //private readonly expiredQueue = new Array<TaskEntry>();

  constructor(options?: PromisePoolOptions) {
    this.options = this.sanitizeOptions(options);
  }

  public async run<T>(task: () => Promise<T>): Promise<T> {
    return await this.enqueueAndRun(task);
  }

  public async runMany<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    const promises = tasks.map((task) => this.enqueueAndRun(task));

    return Promise.all(promises);
  }

  public releaseAll(): void {
    for (const [, releaseFunction] of this.runningQueue) {
      releaseFunction();
    }
  }

  private async acquire(): Promise<ReleaseFunction> {
    return new Promise<ReleaseFunction>((resolve, reject) => {
      const taskEntry = { resolve, reject } satisfies TaskEntry;
      this.waitingQueue.push(taskEntry);
      this.dispatchNextTask();
    });
  }

  private async enqueueAndRun<T>(task: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await task();
    } finally {
      release();
    }
  }

  private dispatchNextTask(): void {
    const conncurrentLimitReached = this.runningQueue.size >= this.options.concurrentLimit;
    if (conncurrentLimitReached) {
      return;
    }

    const nextTask = this.getNextTaskToRun();
    if (!nextTask) {
      return;
    }

    const releaseFunction = this.buildReleaseFunction(nextTask);
    this.runningQueue.set(nextTask, releaseFunction);
    nextTask.resolve(releaseFunction);
  }

  private buildReleaseFunction(taskEntry: TaskEntry): ReleaseFunction {
    const releaseFunction: ReleaseFunction = () => {
      if (!this.runningQueue.has(taskEntry)) {
        return;
      }

      if (taskEntry.releaseTimeoutId) {
        clearTimeout(taskEntry.releaseTimeoutId);
      }

      this.runningQueue.delete(taskEntry);
      this.dispatchNextTask();
    };

    if (this.options.releaseTimeout > 0) {
      taskEntry.releaseTimeoutId = setTimeout(() => {
        releaseFunction();
      }, this.options.releaseTimeout);
    }

    return releaseFunction;
  }

  private getNextTaskToRun(): TaskEntry | undefined {
    let nextTask: TaskEntry | undefined;
    switch (this.options.queueType) {
      case "FIFO":
        nextTask = this.waitingQueue.shift();
        break;
      case "LIFO":
        nextTask = this.waitingQueue.pop();
        break;
    }

    return nextTask;
  }

  private sanitizeOptions(options: PromisePoolOptions | undefined): Required<PromisePoolOptions> {
    if (options === null || options === undefined || Array.isArray(options) || typeof options !== "object") {
      return defaultOptions;
    }

    const sanitizedOptions: any = { ...defaultOptions };

    for (const key in defaultOptions) {
      const typedKey = key as keyof PromisePoolOptions;

      const defaultValue = defaultOptions[typedKey];
      const value = options[typedKey] as any;
      if (value === null || value === undefined) {
        continue;
      }

      const defaultValueType = typeof defaultValue;
      const valueType = typeof value;
      if (defaultValueType !== valueType) {
        continue;
      }

      sanitizedOptions[typedKey] = value;
    }

    return sanitizedOptions as Required<PromisePoolOptions>;
  }
}