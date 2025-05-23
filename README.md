# Tasktly
[![Coverage Status](https://coveralls.io/repos/github/alan-plus/tasktly/badge.svg?branch=development)](https://coveralls.io/github/alan-plus/tasktly?branch=development)
A set of classes that provide assistance with the concurrent control of asynchronous functions.
- Locks
  - [LockMutex](#LockMutex): a lock class to prevent concurrent access to a resource.
  - [LockPool](#LockPool): alternative lock class that allows limited concurrent access to a resource.
- Task Executors
  - [PromiseMutex](#PromiseMutex): a class to prevent concurrent task execution.
  - [PromisePool](#PromisePool): allows limited concurrent task execution.
  - [PromiseMultiStep](#PromiseMultiStep): allows the concurrency of each step to be adjusted.

## Getting started
### Installation:
```
npm install tasktly
```

### LockMutex
Provides a mechanism to prevents concurrent access to a resource.
#### Constructor
`new LockMutex(options?: LockOptions)`
#### LockOptions
- `queueType` ("FIFO" | "LIFO", default: "FIFO")
  - FIFO: first request, first acquire.
  - LIFO: last request, first acquire.
- `releaseTimeout` (milliseconds > 0, defaults: undefined) prevent a task to acquire the lock indefinitely.
- `releaseTimeoutHandler` (defaults: undefined) function to handle releaseTimeout event.
#### How to use
```js
import { LockMutex } from "tasktly";

const lock = new LockMutex();

async function sample () {
  const release = await lock.acquire();
  try {
    // access the resource protected by this lock
  } finally {
    // IMPORTANT: Make sure to always call the `release` function.
    release();
  }
}
```

### LockPool
Use instances of LockPool to allow limited concurrent access to a resource.
#### Constructor
`new LockPool({ concurrentLimit: number })`
#### LockPoolOptions
[LockOptions](#LockOptions) +
- `concurrentLimit` (number, default: 1) max concurrent access to the resource.
```js
import { LockPool } from "tasktly";

  // concurrent access to the resource limited to 2
  const lock = new LockPool({ concurrentLimit: 2 }); 

  await Promise.all([
    
    // Task 1 (will access the resource immediately)
    new Promise<any>(async (resolve) => {
      const release = await lock.acquire();
      try {
        // access the protected resource
        resolve();
      } finally {
        release();
      }
    }),

    // Task 2 (will access the resource immediately)
    new Promise<any>(async (resolve) => {
      const release = await lock.acquire();
      try {
        // access the protected resource
        resolve();
      } finally {
        release();
      }
    }),

    // Task 3 (will access the resource once 'Task 1' or 'Task 2' is completed)
    new Promise<any>(async (resolve) => {
      const release = await lock.acquire();
      try {
        // access the protected resource
        resolve();
      } finally {
        release();
      }
    }),
  ]);
```
Observations: `new LockMutex()` equals to `new LockPool();` equals to `new LockPool({ concurrentLimit: 1 });`