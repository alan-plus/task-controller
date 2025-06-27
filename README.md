[![Coverage Status](https://coveralls.io/repos/github/alan-plus/task-controller/badge.svg)](https://coveralls.io/github/alan-plus/task-controller)
[![npm version](https://badge.fury.io/js/task-controller.svg)](https://badge.fury.io/js/task-controller)
[![npm downloads](https://img.shields.io/npm/dm/task-controller.svg)](https://www.npmjs.com/package/task-controller)
[![bundle size](https://img.shields.io/bundlephobia/min/task-controller)](https://bundlephobia.com/package/task-controller)

# Task Controller

A set of classes that provide assistance with the concurrent access to shared resources and the control of asynchronous tasks.
- Locks
  - [LockController](#LockController): a class that manages concurrent access to resources.
- Tasks
  - [TaskController](#TaskController): a class that manages concurrent asynchronous tasks execution.
  - [MultiStepController](#MultiStepController): a class to adjust the concurrency at step level on multi step tasks execution.

## Getting started

### Installation:

```bash
npm install task-controller
```

### LockController class

Provides a mechanism to control concurrent access to resources.

#### Constructor

`new LockController(options?: LockControllerOptions);`

#### Options

- `concurrency` (number, default: 1) maximum concurrent access to the resource.
- `queueType` ("FIFO" | "LIFO", default: "FIFO")
  - FIFO: first request, first acquire.
  - LIFO: last request, first acquire.
- `releaseTimeout` (milliseconds > 0, defaults: none) prevent a task to acquire the lock indefinitely. If the lock has not already been released by the time the timeout is reached, it is released automatically.
- `releaseTimeoutHandler` (callback, defaults: none) function to handle releaseTimeout event.

#### API Reference

- `acquire(): Promise<() => void>`
Acquires a lock and returns a release function. The release function must be called to free the lock.
- `isLocked(): boolean`
Returns true if the lock is currently acquired by any task.
- `getQueueLength(): number`
Returns the number of tasks waiting to acquire the lock.
- `clearQueue(): void`
Removes all pending tasks from the queue without executing them.

#### How to use

```typescript
import { LockController } from "task-controller";

export async function exampleLockControllerWithConcurrency(concurrency: number){

  const lockController = new LockController({ concurrency });

  const accessTheResource = async (taskId: number) => {
    const release = await lockController.acquire();
    console.log(`Task ${taskId} acquire the lock`);
    try {
      // access the resource protected by this lock
      await setTimeout(1, 'just to simulate some logic');
    } finally {
      // IMPORTANT: Make sure to always call the `release` function.
      release();
      console.log(`Task ${taskId} release the lock`);
    }
  };

  await Promise.all([accessTheResource(1), accessTheResource(2), accessTheResource(3)]);
}

```
`exampleLockControllerWithConcurrency(1);`
```console
Task 1 acquire the lock
Task 1 release the lock
Task 2 acquire the lock
Task 2 acquire the lock
Task 3 acquire the lock
Task 3 release the lock
```
`exampleLockControllerWithConcurrency(2);`
```console
Task 1 acquire the lock
Task 2 acquire the lock
Task 1 release the lock
Task 3 acquire the lock
Task 2 release the lock
Task 3 release the lock
```

### TaskController class

Provides a mechanism to control concurrent asynchronous tasks execution. 

#### Constructor

`new TaskController<T>(options?: TaskControllerOptions);`
- `T`: the type returned by the task

#### Options

- `concurrency` (number, default: 1) maximum concurrent task execution.
- `queueType` ("FIFO" | "LIFO", default: "FIFO")
  - FIFO: first request, first run.
  - LIFO: last request, first run.
- `waitingTimeout` (milliseconds > 0, defaults: none) if a task reaches its timeout before being selected for execution, it is automatically discarded.
- `waitingTimeoutHandler` (callback, defaults: none) function to handle waitingTimeout event.
- `releaseTimeout` (milliseconds > 0, defaults: none) if a running task exceeds its timeout limit before completing, it will continue running, but will be marked as expired. This enables another task to be selected for execution.
- `releaseTimeoutHandler` (callback, defaults: none) function to handle releaseTimeout event.
- `errorHandler`(callback, defaults: none) function to handle task error event.
- `signal` (AbortSignal, defaults: none) once the signal has been aborted, no more tasks will be selected for execution. Any tasks that are currently running will continue as normal until completion.

#### API Reference

- `runForEach<T>(entities: T[], task: (entity: T) => Promise<any>): Promise<any[]>`
Executes a task for each entity in the array, respecting the concurrency limit. Returns an array with the results of each task execution.
- `runMany<T>(tasks: TaskEntry<T>[]): Promise<T[]>`
Executes multiple tasks, respecting the concurrency limit. Returns an array with the results of each task execution.
- `run<T>(task: () => Promise<T>): Promise<T>`
Executes a single task, respecting the concurrency limit. Returns the result of the task execution.
- `isRunning(): boolean`
Returns true if there are tasks currently running.
- `getQueueLength(): number`
Returns the number of tasks waiting to be executed.
- `clearQueue(): void`
Removes all pending tasks from the queue without executing them.
- `on(event: string, listener: (...args: any[]) => void): void`
Adds an event listener for task events (error, waitingTimeout, releaseTimeout).
- `off(event: string, listener: (...args: any[]) => void): void`
Removes an event listener for task events.

#### How to use

```typescript
import { TaskController } from "task-controller";

export async function exampleTaskControllerWithConcurrency(concurrency: number){
  const taskController = new TaskController({ concurrency });

  const task = async (taskId: number) {
    console.log(`Task ${taskId} selected to be executed`);

    await setTimeout(1, 'just to simulate some logic');

    console.log(`Task ${taskId} finished`);
  }

  await taskController.runForEach([ 1, 2, 3 ], task);
}
```
`exampleTaskControllerWithConcurrency(1);`
```console
Task 1 selected to be executed
Task 1 finished
Task 2 selected to be executed
Task 2 finished
Task 3 selected to be executed
Task 3 finished
```
`exampleTaskControllerWithConcurrency(2);`
```console
Task 1 selected to be execute
Task 2 selected to be executed
Task 1 finished
Task 3 selected to be executed
Task 2 finished
Task 3 finished
```
### MultiStepController class

Provides a mechanism to control concurrent multi step tasks execution. 

#### Constructor

`new MultiStepController<T, N>(options: MultiStepControllerOptions);`
- `T`: the type returned by the task
- `N`: number of steps

#### Options

- `stepConcurrencies` (number[], mandatory) the cuncurrency limit of each step.

#### API Reference

- `runForEach<T>(entities: T[], task: (stepLocks: FixedLengthArray<LockController, N>, entity: T) => Promise<void>): Promise<void>` - Executes a task for each entity with step concurrency control
- `runMany<T>(tasks: Array<{ task: (stepLocks: FixedLengthArray<LockController, N>) => Promise<T>, args?: any[] }>): Promise<T[]>` - Executes multiple tasks with step concurrency control
- `run<T>(task: (stepLocks: FixedLengthArray<LockController, N>) => Promise<T>, args?: any[]): Promise<T>` - Executes a single task with step concurrency control



#### How to use
```typescript
import { MultiStepController } from "task-controller";

export async function exampleMultiStepControllerWithConcurrency(){
  const multiStepController = new MultiStepController<void, 2>({ stepConcurrencies: [1, 2] });

  const task = async (
    stepLocks: FixedLengthArray<LockController, 2>,
    entity: { taskId: number; step1Timeout: number; step2Timeout: number }
  ) => {
    const release1 = await stepLocks[0].acquire();
    try {
      console.log(`Task ${entity.taskId} selected to execute step 1`);
      await setTimeout(entity.step1Timeout, "just to simulate some logic");
      console.log(`Task ${entity.taskId} finished step 1`);
    } finally {
      release1();
    }

    const release2 = await stepLocks[1].acquire();
    try {
      console.log(`Task ${entity.taskId} selected to execute step 2`);
      await setTimeout(entity.step2Timeout, "just to simulate some logic");
      console.log(`Task ${entity.taskId} finished step 2`);
    } finally {
      release2();
    }
  };

  await multiStepController.runForEach(
    [
      { taskId: 1, step1Timeout: 40, step2Timeout: 120 },
      { taskId: 2, step1Timeout: 30, step2Timeout: 50 },
      { taskId: 3, step1Timeout: 30, step2Timeout: 50 },
    ],
    task
  );
}
```
`exampleMultiStepControllerWithConcurrency();`
```console
Task 1 selected to execute step 1
Task 1 finished step 1
Task 2 selected to execute step 1
Task 1 selected to execute step 2
Task 2 finished step 1
Task 3 selected to execute step 1
Task 2 selected to execute step 2
Task 3 finished step 1
Task 2 finished step 2
Task 3 selected to execute step 2
Task 1 finished step 2
Task 3 finished step 2
```
