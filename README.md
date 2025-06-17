[![Coverage Status](https://coveralls.io/repos/github/alan-plus/task-controller/badge.svg?branch=development)](https://coveralls.io/github/alan-plus/task-controller?branch=development)

# Lock and Task Controller

A set of classes that provide assistance with the concurrent access to shared resources and the control of asynchronous tasks.
- Locks
  - [LockController](#LockController): a class that manages concurrent access to resources.
- Tasks
  - [TaskController](#TaskController): a class that manages concurrent asynchronous tasks execution.
  - [MultiStepController](#MultiStepController): a class to adjust the concurrency at step level on multi step tasks execution.

## Getting started

### Installation:

```
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

#### How to use

```js
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

`new TaskController(options?: TaskControllerOptions);`

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

#### How to use

```js
import { TaskController } from "task-controller";

export async function exampleTaskControllerWithConcurrency(concurrency: number){
  const taskController = new TaskController<string>({ concurrency });

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

Provides a mechanism to control concurrent asynchronous multi step tasks execution. 

#### Constructor

`new MultiStepController(options: MultiStepControllerOptions);`

#### Options

- `stepConcurrencies` (number[], mandatory) the cuncurrency limit of each step.