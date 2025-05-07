import { RunningTask, TaskEntry, WaitingTask } from "../interfaces/task-entry";
import { TaskExecutor } from "../interfaces/task.executor";
import { EventEmitter } from "events";
import { PromisePoolOptions, TaskOptions } from "../types/promise-options.type";

export type TryRunResponse<T> = { acquired: boolean; run?: Promise<PromiseSettledResult<T>> };
export type TaskEvent = "error" | "task-started" | "task-finished" | "task-failure" | "task-released-before-finished" | "task-discarded";
export type TaskErrorCode = "waiting-timeout-handler-failure" | "release-timeout-handler-failure" | "error-handler-failure";
export type TaskEventError = { code: TaskErrorCode; error: any };

export type ReleaseBeforeFinishReason = "timeoutReached" | "forced";
export type DiscardReason = "timeoutReached" | "forced" | "abortSignal";

export interface TaskExecutorReleaseFunction {
  (reason?: ReleaseBeforeFinishReason): void;
}

const defaultOptions: Required<PromisePoolOptions> = {
  concurrentLimit: 1,
  queueType: "FIFO",
  releaseTimeout: 0,
  releaseTimeoutHandler: () => {},
  waitingTimeout: 0,
  waitingTimeoutHandler: () => {},
  errorHandler: (error: any) => {},
  signal: { aborted: false } as AbortSignal,
} satisfies PromisePoolOptions;

export class PromisePool<T> extends EventEmitter implements TaskExecutor<T> {
  private readonly options: Required<PromisePoolOptions>;

  private readonly waitingQueue = new Array<WaitingTask>();
  private readonly runningQueue = new Map<RunningTask, TaskExecutorReleaseFunction>();
  private readonly expiredQueue = new Set<RunningTask>();

  constructor(options?: PromisePoolOptions) {
    super();
    this.options = this.sanitizeOptions(options);
  }

  public override on(event: TaskEvent, listener: () => void): this {
    return super.on(event, listener);
  }

  public override emit(event: TaskEvent, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  public async run<T>(task: () => Promise<T>, options?: TaskOptions): Promise<PromiseSettledResult<T>> {
    return await this.enqueueAndRun(task, this.sanitizeTaskOptions(options));
  }

  public async runMany<T>(tasks: Array<() => Promise<T>>, options?: TaskOptions): Promise<PromiseSettledResult<T>[]> {
    const promises = tasks.map((task) => this.enqueueAndRun(task, this.sanitizeTaskOptions(options)));

    return Promise.all(promises);
  }

  public tryRun<T>(task: () => Promise<T>, options?: TaskOptions): TryRunResponse<T> {
    const someOneIsWaitingTheLock = this.waitingQueue.length > 0;
    if (someOneIsWaitingTheLock) {
      return { acquired: false };
    }

    const conncurrentLimitReached = this.runningQueue.size >= this.options.concurrentLimit;
    if (conncurrentLimitReached) {
      return { acquired: false };
    }

    return { acquired: true, run: this.enqueueAndRun(task, this.sanitizeTaskOptions(options)) };
  }

  public releaseAll(): void {
    for (const [, releaseFunction] of this.runningQueue) {
      releaseFunction("forced");
    }
  }

  public flushPendingTasks(): void {
    if (!this.waitingQueue.length) {
      return;
    }

    const waitingQueueCopy = [...this.waitingQueue];
    this.waitingQueue.splice(0, this.waitingQueue.length);

    for (const taskEntry of waitingQueueCopy) {
      taskEntry.discardReason = "forced";
      this.emit("task-discarded", taskEntry);

      if (taskEntry.waitingTimeoutId) {
        clearTimeout(taskEntry.waitingTimeoutId);
      }
    }
  }

  private async acquire(options?: TaskOptions): Promise<TaskExecutorReleaseFunction> {
    return new Promise<TaskExecutorReleaseFunction>((resolve, reject) => {
      const taskEntry: WaitingTask = { resolve, reject, options } satisfies WaitingTask;
      this.waitingQueue.push(taskEntry);

      const waitingTimeout = taskEntry.options?.waitingTimeout ?? this.options.waitingTimeout;
      if (waitingTimeout > 0) {
        taskEntry.waitingTimeoutId = setTimeout(() => {
          const taskIndex = this.waitingQueue.indexOf(taskEntry);
          if (taskIndex > -1) {
            this.waitingQueue.splice(taskIndex, 1);
          }
          taskEntry.discardReason = "timeoutReached";
          this.emit("task-discarded", taskEntry);

          try {
            const timeoutHandler = taskEntry.options?.waitingTimeoutHandler ?? this.options.waitingTimeoutHandler;
            timeoutHandler();
          } catch (error) {
            this.emit("error", { code: "waiting-timeout-handler-failure", error } as TaskEventError);
          }
        }, waitingTimeout);
      }

      this.dispatchNextTask();
    });
  }

  private async enqueueAndRun<T>(task: () => Promise<T>, options?: TaskOptions): Promise<PromiseSettledResult<T>> {
    const release = await this.acquire(options);
    try {
      const value = await task();

      return { status: "fulfilled", value } as PromiseSettledResult<T>;
    } catch (error) {
      this.emit("task-failure", error);

      try {
        const errorHandler = options?.errorHandler ?? this.options.errorHandler;
        errorHandler(error);
      } catch (errorOnErrorHandler) {
        this.emit("error", { code: "error-handler-failure", error: errorOnErrorHandler } as TaskEventError);
      }

      return { status: "rejected", reason: error } as PromiseSettledResult<T>;
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

    const releaseFunction = this.start(nextTask);

    nextTask.resolve(releaseFunction);
  }

  private start(waitingTask: TaskEntry): TaskExecutorReleaseFunction {
    const runningTask = { timeoutReached: false, options: waitingTask.options } as RunningTask;
    const releaseFunction = this.buildReleaseFunction(runningTask);
    this.runningQueue.set(runningTask, releaseFunction);
    this.emit("task-started", runningTask);

    return releaseFunction;
  }

  private buildReleaseFunction(taskEntry: RunningTask): TaskExecutorReleaseFunction {
    const releaseFunction: TaskExecutorReleaseFunction = (reason?: ReleaseBeforeFinishReason) => {
      if (this.expiredQueue.has(taskEntry)) {
        this.expiredQueue.delete(taskEntry);
        this.emit("task-finished", taskEntry);
      }

      if (!this.runningQueue.has(taskEntry)) {
        return;
      }

      if (taskEntry.releaseTimeoutId) {
        clearTimeout(taskEntry.releaseTimeoutId);
      }

      this.runningQueue.delete(taskEntry);
      switch (reason) {
        case "timeoutReached":
        case "forced":
          taskEntry.releaseReason = reason;
          this.expiredQueue.add(taskEntry);
          this.emit("task-released-before-finished", taskEntry);
          break;
        default:
          this.emit("task-finished", taskEntry);
          break;
      }

      this.dispatchNextTask();
    };

    const releaseTimeout = taskEntry.options?.releaseTimeout ?? this.options.releaseTimeout;
    if (releaseTimeout > 0) {
      taskEntry.releaseTimeoutId = setTimeout(() => {
        releaseFunction("timeoutReached");

        try {
          const timeoutHandler = taskEntry.options?.releaseTimeoutHandler ?? this.options.releaseTimeoutHandler;
          timeoutHandler();
        } catch (error) {
          this.emit("error", { code: "release-timeout-handler-failure", error } as TaskEventError);
        }
      }, releaseTimeout);
    }

    return releaseFunction;
  }

  private getNextTaskToRun(): WaitingTask | undefined {
    let taskEntry: WaitingTask | undefined;
    switch (this.options.queueType) {
      case "FIFO":
        taskEntry = this.waitingQueue.shift();
        break;
      case "LIFO":
        taskEntry = this.waitingQueue.pop();
        break;
    }

    if (!taskEntry) {
      return undefined;
    }

    if (taskEntry.waitingTimeoutId) {
      clearTimeout(taskEntry.waitingTimeoutId);
    }

    const signal = taskEntry.options?.signal ?? this.options.signal;
    if (signal && signal.aborted) {
      taskEntry.discardReason = "abortSignal";
      this.emit("task-discarded", taskEntry);

      return this.getNextTaskToRun();
    }

    return taskEntry;
  }

  private sanitizeTaskOptions(options: TaskOptions | undefined): TaskOptions | undefined {
    if (options === null || options === undefined || Array.isArray(options) || typeof options !== "object") {
      return undefined;
    }

    const sanitizedOptions: TaskOptions = {};

    for (const key in defaultOptions) {
      const typedKey = key as keyof TaskOptions;

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

    return sanitizedOptions;
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
