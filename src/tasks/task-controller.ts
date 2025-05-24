import { EventEmitter } from "events";
import {
  TaskControllerOptions,
  ReleaseBeforeFinishReason,
  TaskEntry,
  TaskEvent,
  TaskEventError,
  TaskOptions,
  TryRunResponse,
} from "./task-controller.type";
import { OptionsSanitizerUtils } from "../utils/options-sanitizer.utils";

type WaitingTask = TaskEntry & {
  resolve(result: AcquireResponse): void;
  reject(reason?: any): void;
  waitingTimeoutId?: NodeJS.Timeout;
};
type RunningTask = TaskEntry & { releaseTimeoutId?: NodeJS.Timeout };
type TaskControllerReleaseFunction = { (reason?: ReleaseBeforeFinishReason): void };
type AcquireResponse = {
  release: TaskControllerReleaseFunction;
  taskEntry: TaskEntry;
};

const defaultOptions: Required<TaskControllerOptions> = {
  concurrency: 1,
  queueType: "FIFO",
  releaseTimeout: 0,
  releaseTimeoutHandler: () => {},
  waitingTimeout: 0,
  waitingTimeoutHandler: () => {},
  errorHandler: () => {},
  signal: { aborted: false } as AbortSignal,
} satisfies TaskControllerOptions;

export class TaskController<T> {
  private readonly options: Required<TaskControllerOptions>;
  private readonly waitingQueue = new Array<WaitingTask>();
  private readonly runningQueue = new Map<RunningTask, TaskControllerReleaseFunction>();
  private readonly expiredQueue = new Set<RunningTask>();
  private readonly internalEmitter = new EventEmitter();

  constructor(options?: TaskControllerOptions) {
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

  public async run<T>(task: (...args: any[]) => Promise<T>, ...args: any[]): Promise<PromiseSettledResult<T>> {
    return await this.enqueueAndRun(task, undefined, args);
  }

  public async runWithOptions<T>(
    task: (...args: any[]) => Promise<T>,
    options: TaskOptions,
    ...args: any[]
  ): Promise<PromiseSettledResult<T>> {
    return await this.enqueueAndRun(task, OptionsSanitizerUtils.sanitize(options, defaultOptions), args);
  }

  public async runMany<T>(
    tasks: { task: (...args: any[]) => Promise<T>; options?: TaskOptions; args?: any[] }[]
  ): Promise<PromiseSettledResult<T>[]> {
    const promises = tasks.map((taskData) => {
      const { task, options, args } = taskData;
      return this.enqueueAndRun(task, OptionsSanitizerUtils.sanitize(options, defaultOptions), args);
    });

    return Promise.all(promises);
  }

  public async runForEach<T>(
    argsArray: any[],
    task: (...args: any[]) => Promise<T>,
    options?: TaskOptions
  ): Promise<PromiseSettledResult<T>[]> {
    const sanitizeOptions = OptionsSanitizerUtils.sanitize(options, defaultOptions);

    const promises = argsArray.map((args) => {
      return this.enqueueAndRun(task, sanitizeOptions, args);
    });

    return Promise.all(promises);
  }

  public tryRun<T>(task: (...args: any[]) => Promise<T>, ...args: any[]): TryRunResponse<T> {
    return this.tryRunWithOptions(task, undefined, args);
  }

  public tryRunWithOptions<T>(task: (...args: any[]) => Promise<T>, options?: TaskOptions, ...args: any[]): TryRunResponse<T> {
    const someOneIsWaitingTheLock = this.waitingQueue.length > 0;
    if (someOneIsWaitingTheLock) {
      return { available: false };
    }

    const conncurrentLimitReached = this.runningQueue.size >= this.options.concurrency;
    if (conncurrentLimitReached) {
      return { available: false };
    }

    return { available: true, run: () => this.enqueueAndRun(task, OptionsSanitizerUtils.sanitize(options, defaultOptions), args) };
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

  public isAvailable(): boolean {
    const conncurrentLimitReached = this.runningQueue.size >= this.options.concurrency;
    return !conncurrentLimitReached;
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

    const increased = newConcurrentLimit > this.options.concurrency;
    this.options.concurrency = newConcurrentLimit;
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

  private async acquire(options?: TaskOptions, ...args: any[]): Promise<AcquireResponse> {
    return new Promise<AcquireResponse>((resolve, reject) => {
      const taskEntry: WaitingTask = { resolve, reject, args, options } satisfies WaitingTask;
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

  private async enqueueAndRun<T>(
    task: (...args: any[]) => Promise<T>,
    options?: TaskOptions,
    ...args: any[]
  ): Promise<PromiseSettledResult<T>> {
    const { release, taskEntry } = await this.acquire(options, args);
    try {
      const value = await task(taskEntry.args);

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
    if (!this.isAvailable()) {
      return;
    }

    const nextTask = this.getNextTaskToRun();
    if (!nextTask) {
      return;
    }

    const releaseFunction = this.start(nextTask);

    nextTask.resolve({ release: releaseFunction, taskEntry: nextTask } satisfies AcquireResponse);
  }

  private start(waitingTask: TaskEntry): TaskControllerReleaseFunction {
    const runningTask = { timeoutReached: false, args: waitingTask.args, options: waitingTask.options } as RunningTask;
    const releaseFunction = this.buildReleaseFunction(runningTask);
    this.runningQueue.set(runningTask, releaseFunction);
    this.emit("task-started", runningTask);

    return releaseFunction;
  }

  private buildReleaseFunction(taskEntry: RunningTask): TaskControllerReleaseFunction {
    const releaseFunction: TaskControllerReleaseFunction = (reason?: ReleaseBeforeFinishReason) => {
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

  private sanitizeOptions(options?: TaskControllerOptions): Required<TaskControllerOptions> {
    if (options) {
      const sanitizedConcurrentLimit = OptionsSanitizerUtils.sanitizeNumberToPositiveGraterThanZeroInteger(options.concurrency);
      if (sanitizedConcurrentLimit === undefined) {
        delete options.concurrency;
      } else {
        options.concurrency = sanitizedConcurrentLimit;
      }
    }

    return OptionsSanitizerUtils.sanitizeToRequired(options, defaultOptions);
  }
}
