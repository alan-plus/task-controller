import { RunningTask, TaskEntry, WaitingTask } from "../interfaces/task-entry";
import { TaskExecutor } from "../interfaces/task.executor";
import { EventEmitter } from "events";
import { PromisePoolOptions, TaskOptions } from "../types/promise-options.type";
import { OptionsSanitizerUtils } from "../utils/options-sanitizer.utils";

export type TryRunResponse<T> = { available: true; run: () => Promise<PromiseSettledResult<T>> } | { available: false; run?: undefined };
export type TaskEvent = "error" | "task-started" | "task-finished" | "task-failure" | "task-released-before-finished" | "task-discarded";
export type TaskErrorCode = "waiting-timeout-handler-failure" | "release-timeout-handler-failure" | "error-handler-failure";
export type TaskEventError = { code: TaskErrorCode; error: any };

export type ReleaseBeforeFinishReason = "timeoutReached" | "forced";
export type DiscardReason = "timeoutReached" | "forced" | "abortSignal";

export interface TaskExecutorReleaseFunction {
  (reason?: ReleaseBeforeFinishReason): void;
}

export interface AcquireResponse {
  release: TaskExecutorReleaseFunction;
  taskEntry: TaskEntry;
}

const defaultOptions: Required<PromisePoolOptions> = {
  concurrentLimit: 1,
  queueType: "FIFO",
  releaseTimeout: 0,
  releaseTimeoutHandler: () => {},
  waitingTimeout: 0,
  waitingTimeoutHandler: () => {},
  errorHandler: () => {},
  signal: { aborted: false } as AbortSignal,
} satisfies PromisePoolOptions;

export class PromisePool<T> implements TaskExecutor<T> {
  private readonly options: Required<PromisePoolOptions>;
  private readonly waitingQueue = new Array<WaitingTask>();
  private readonly runningQueue = new Map<RunningTask, TaskExecutorReleaseFunction>();
  private readonly expiredQueue = new Set<RunningTask>();
  private readonly internalEmitter = new EventEmitter();

  constructor(options?: PromisePoolOptions) {
    this.options = this.sanitizeOptions(options);
  }

  public on(event: TaskEvent, listener: (taskEntry: TaskEntry, ...args: any[]) => void): this {
    this.internalEmitter.on(event, listener);
    return this;
  }

  public off(event: TaskEvent, listener: (taskEntry: TaskEntry, ...args: any[]) => void): this {
    this.internalEmitter.off(event, listener);
    return this;
  }

  public async run<T>(task: (arg?: any) => Promise<T>, arg?: any, options?: TaskOptions): Promise<PromiseSettledResult<T>> {
    return await this.enqueueAndRun(task, arg, OptionsSanitizerUtils.sanitize(options, defaultOptions));
  }

  public async runMany<T>(
    tasks: Array<(arg?: any) => Promise<T>>,
    args?: any[],
    options?: TaskOptions
  ): Promise<PromiseSettledResult<T>[]> {
    const promises = tasks.map((task, index) => {
      const arg = args?.length ? args[index] : undefined;
      return this.enqueueAndRun(task, arg ?? undefined, OptionsSanitizerUtils.sanitize(options, defaultOptions));
    });

    return Promise.all(promises);
  }

  public tryRun<T>(task: (arg?: any) => Promise<T>, arg?: any, options?: TaskOptions): TryRunResponse<T> {
    const someOneIsWaitingTheLock = this.waitingQueue.length > 0;
    if (someOneIsWaitingTheLock) {
      return { available: false };
    }

    const conncurrentLimitReached = this.runningQueue.size >= this.options.concurrentLimit;
    if (conncurrentLimitReached) {
      return { available: false };
    }

    return { available: true, run: () => this.enqueueAndRun(task, arg, OptionsSanitizerUtils.sanitize(options, defaultOptions)) };
  }

  public releaseRunningTasks(): void {
    if (!this.runningQueue.size) {
      return;
    }

    const runningQueueCopy = [...this.runningQueue];
    for (const [, releaseFunction] of runningQueueCopy) {
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

  public isRunningLimitReached(): boolean {
    const conncurrentLimitReached = this.runningQueue.size >= this.options.concurrentLimit;
    return conncurrentLimitReached;
  }

  public changeConcurrentLimit(newConcurrentLimit: number): void {
    if (newConcurrentLimit === null || newConcurrentLimit === undefined) {
      return;
    }

    if (!Number.isInteger(newConcurrentLimit)) {
      return;
    }

    if (newConcurrentLimit < 1) {
      return;
    }

    const increased = newConcurrentLimit > this.options.concurrentLimit;
    this.options.concurrentLimit = newConcurrentLimit;
    if (increased) {
      this.dispatchNextTask();
    }
  }

  public waitingTasks(): number {
    return this.waitingQueue.length;
  }

  public runningTasks(): number {
    return this.runningQueue.size;
  }

  public expiredTasks(): number {
    return this.expiredQueue.size;
  }

  private emit(event: TaskEvent, ...args: any[]): boolean {
    return this.internalEmitter.emit(event, ...args);
  }

  private async acquire(arg?: any, options?: TaskOptions): Promise<AcquireResponse> {
    return new Promise<AcquireResponse>((resolve, reject) => {
      const taskEntry: WaitingTask = { resolve, reject, arg, options } satisfies WaitingTask;
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
            timeoutHandler(taskEntry);
          } catch (error) {
            this.emit("error", taskEntry, { code: "waiting-timeout-handler-failure", error } as TaskEventError);
          }
        }, waitingTimeout);
      }

      this.dispatchNextTask();
    });
  }

  private async enqueueAndRun<T>(task: (arg?: any) => Promise<T>, arg?: any, options?: TaskOptions): Promise<PromiseSettledResult<T>> {
    const { release, taskEntry } = await this.acquire(arg, options);
    try {
      const value = await task(taskEntry.arg);

      return { status: "fulfilled", value } as PromiseSettledResult<T>;
    } catch (error) {
      this.emit("task-failure", taskEntry, error);

      try {
        const errorHandler = options?.errorHandler ?? this.options.errorHandler;
        errorHandler(taskEntry, error);
      } catch (errorOnErrorHandler) {
        this.emit("error", taskEntry, { code: "error-handler-failure", error: errorOnErrorHandler } as TaskEventError);
      }

      return { status: "rejected", reason: error } as PromiseSettledResult<T>;
    } finally {
      release();
    }
  }

  private dispatchNextTask(): void {
    if (this.isRunningLimitReached()) {
      return;
    }

    const nextTask = this.getNextTaskToRun();
    if (!nextTask) {
      return;
    }

    const releaseFunction = this.start(nextTask);

    nextTask.resolve({ release: releaseFunction, taskEntry: nextTask } satisfies AcquireResponse);
  }

  private start(waitingTask: TaskEntry): TaskExecutorReleaseFunction {
    const runningTask = { timeoutReached: false, arg: waitingTask.arg, options: waitingTask.options } as RunningTask;
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
          timeoutHandler(taskEntry);
        } catch (error) {
          this.emit("error", taskEntry, { code: "release-timeout-handler-failure", error } as TaskEventError);
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

  private sanitizeOptions(options?: PromisePoolOptions): Required<PromisePoolOptions> {
    if (options) {
      const sanitizedConcurrentLimit = OptionsSanitizerUtils.sanitizeNumberToPositiveGraterThanZeroInteger(options.concurrentLimit);
      if (sanitizedConcurrentLimit === undefined) {
        delete options.concurrentLimit;
      } else {
        options.concurrentLimit = sanitizedConcurrentLimit;
      }
    }

    return OptionsSanitizerUtils.sanitizeToRequired(options, defaultOptions);
  }
}
