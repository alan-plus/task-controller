[![Coverage Status](https://coveralls.io/repos/github/alan-plus/pro-task/badge.svg?branch=development)](https://coveralls.io/github/alan-plus/pro-task?branch=development)
# Pro-Task
A set of classes that provide assistance with the concurrent control of asynchronous functions.
- Locks
  - [LockMutex](#LockMutex): prevents concurrent access to resources.
  - [LockPool](#LockPool): allows limited concurrent access to resources.
- Task Executors
  - [PromiseMutex](#PromiseMutex): prevents concurrent task execution.
  - [PromisePool](#PromisePool): allows limited concurrent task execution.
  - [PromiseMultiStep](#PromiseMultiStep): allows the concurrency of each step to be adjusted.

## Getting started
### Installation:
```
npm install pro-task
```

### LockMutex
Use instances of LockMutex to protect access to resources.
```
import { LockMutex } from "pro-task";

const lock = new LockMutex();

async function sample () {
  const release = await lock.acquire();
  try {
    // access the resource protected by this lock
  } finally {
    release();
  }
}
```
**IMPORTANT:** Make sure to always call the `release` function
### LockPool
Use instances of LockPool to allow limited concurrent access to resources.

```
import { LockPool } from "pro-task";

  // concurrent access to resource limited to 2
  const lock = new LockPool({ concurrentLimit: 2 }); 

  await Promise.all([
    
    // Task 1 (will access the resource immediately)
    new Promise<any>(async (resolve) => {
      await l.lock();
      try {
        // access the resource protected by this lock
        resolve();
      } finally {
        l.unlock();
      }
    }),

    // Task 2 (will access the resource immediately)
    new Promise<any>(async (resolve) => {
      await l.lock();
      try {
        // access the resource protected by this lock
        resolve();
      } finally {
        l.unlock();
      }
    }),

    // Task 3 (will access the resource once 'Task 1' or 'Task 2' is completed)
    new Promise<any>(async (resolve) => {
      await l.lock();
      try {
        // access the resource protected by this lock
        resolve();
      } finally {
        l.unlock();
      }
    }),
  ]);
```