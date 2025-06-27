import { LockController } from "../locks/lock-controller";
import { AllowedLengths, FixedLengthArray, MultiStepControllerOptions, MultiStepTask } from "./task-controller.types";

/**
 * The MultiStepController class provides a mechanism to control cconcurrent multi step tasks execution.
 *
 * Example of using MultiStepController to limit event handler concurrency:
 * ```js
 * import { MultiStepController } from "task-controller";
 *
 * // Create a multi-step controller that only allows one task at a time for the first step and two tasks at a time for the second step
 * const multiStepController = new MultiStepController<void, 2>({ stepConcurrencies: [1, 2] });
 *
 * // Create an event handler
 * const handleEvent = async (stepLocks: FixedLengthArray<LockController, 2>, event: any) => {
 *   // Process the event
 *   const release1 = await stepLocks[0].acquire();
 *   try {
 *     console.log(`Step 1 - Processing event: ${event.id}``);
 *     await someAsyncOperation(event);
 *     console.log(`Step 1 - Finished processing event: ${event.id}`);
 *   } finally {
 *     release1();
 *   }
 *
 *   const release2 = await stepLocks[1].acquire();
 *   try {
 *     console.log(`Step 2 - Processing event: ${event.id}``);
 *     await someAsyncOperation(event);
 *     console.log(`Step 2 - Finished processing event: ${event.id}`);
 *   } finally {
 *     release2();
 *   }
 * };
 * 
 * // Use the multiStepController on the event emitter to control the concurrency of the event handler
 * eventEmitter.on("event", async (...args) => {
 *   multiStepController.run(handleEvent, ...args);
 * });
 * ```
 *
 * @since v1.0.0
 * @see [source](https://github.com/alan-plus/task-controller/blob/v1.0.0/src/tasks/multi-step-controller.ts)
 */
export class MultiStepController<T, N extends AllowedLengths> {
  private readonly options: Required<MultiStepControllerOptions<N>>;
  private readonly stepLocks;

  /**
   * Creates a new MultiStepController instance.
   * @param options {MultiStepControllerOptions<N>}.
   */
  constructor(options: MultiStepControllerOptions<N>) {
    this.options = options;

    const _stepLocks = new Array<LockController>();
    this.options.stepConcurrencies.forEach((concurrentLimit) => {
      _stepLocks.push(new LockController({ concurrency: concurrentLimit }));
    });

    this.stepLocks = _stepLocks as FixedLengthArray<LockController, N>;
  }

  /**
   * Runs a multi-step task with the given arguments.
   *
   * @param task The multi-step task function to run
   * @param args The arguments to pass to the task
   * @returns A promise that resolves when the task is finished
   */
  public async run(task: MultiStepTask<T, N>, ...args: any[]): Promise<T> {
    return await task(this.stepLocks, ...args);
  }

  /**
   * Runs multiple multi-step tasks with the given arguments.
   *
   * @param tasks The multi-step tasks to run
   * @returns A promise that resolves when the tasks are finished
   */
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

  /**
   * Runs a multi-step task for each argument array.
   *
   * @param argsArray The argument arrays to pass to the task
   * @param task The multi-step task function to run
   * @returns A promise that resolves when the tasks are finished
   */
  public async runForEachArgs(argsArray: any[][], task: MultiStepTask<T, N>): Promise<T[]> {
    const promises = argsArray.map((args) => {
      return task(this.stepLocks, ...args);
    });

    return Promise.all(promises);
  }

  /**
   * Runs a multi-step task for each entity.
   *
   * @param entities The entities to pass to the task
   * @param task The multi-step task function to run
   * @returns A promise that resolves when the tasks are finished
   */
  public async runForEach<E>(entities: E[], task: (stepLocks: FixedLengthArray<LockController, N>, entity: E) => Promise<T>): Promise<T[]> {
    const promises = entities.map((entity) => {
      return task(this.stepLocks, entity);
    });

    return Promise.all(promises);
  }

  /**
   * Releases all acquired locks.
   */
  public releaseAll(): void {
    for (const lock of this.stepLocks) {
      lock.releaseAcquiredLocks();
    }
  }

  /**
   * Checks if the step lock limit is reached.
   *
   * @param stepIndex The index of the step to check
   * @returns True if the step lock limit is reached, false otherwise
   */
  public isStepLockLimitReached(stepIndex: number): boolean {
    const stepLock = this.stepLocks[stepIndex];
    if (!stepLock) {
      return false;
    }

    return !stepLock.isAvailable();
  }
}
