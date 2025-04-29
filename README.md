# Pro-Task
A set of classes to help with concurrent control of async function.
- Locks
  - [LockMutex](#LockMutex): to prevent concurrent access to resource.
  - [LockPool](#LockPool): to allow limited concurrent access to resource.
- Task Executors
  - [PromiseMutex](#PromiseMutex): to prevent concurrent task execution
  - [PromisePool](#PromisePool): to allow limited concurrent task execution
  - [PromiseMultiStep](#PromiseMultiStep): to customize the concurrence of each step

## Getting started
Install with npm:
```
npm install pro-task
```

### LockMutex

```
import { LockMutex } from "pro-task";

  const lock = new LockMutex();

  const release = await lock.acquire();
  try {
    // access the resource protected by this lock
  } finally {
    release();
  }
```
### LockPool

```
import { LockPool } from "pro-task";

  // concurrent access to resource limited to 2
  const l = new LockPool({ concurrentLimit: 2 }); 

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