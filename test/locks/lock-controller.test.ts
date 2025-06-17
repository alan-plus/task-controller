import { setTimeout } from "timers/promises";
import { LockController } from "../../src/locks/lock-controller";
import { LockEventError, ReleaseFunction } from "../../src/locks/lock-controller.types";

class Task {
  constructor(
    private readonly result: string,
    private readonly lockController?: LockController
  ) {}

  public async run(timeout: number, resultsInOrder?: string[]): Promise<string> {
    return new Promise<string>(async (resolve) => {
      let release: ReleaseFunction | undefined;
      try {
        if (this.lockController) {
          release = await this.lockController.acquire();
        }
        await setTimeout(timeout, undefined);

        if (resultsInOrder) {
          resultsInOrder.push(this.result);
        }

        resolve(this.result);
      } finally {
        if (release) {
          release();
        }
      }
    });
  }
}

async function exampleLockControllerWithConcurrency(concurrency: number, console: string[]) {
  const lockController = new LockController({ concurrency });

  const accessTheResource = async (taskId: number) => {
    const release = await lockController.acquire();
    console.push(`Task ${taskId} acquire the lock`);
    try {
      // access the resource protected by this lock
      await setTimeout(1, "just to simulate some logic");
    } finally {
      // IMPORTANT: Make sure to always call the `release` function.
      release();
      console.push(`Task ${taskId} release the lock`);
    }
  };

  await Promise.all([accessTheResource(1), accessTheResource(2), accessTheResource(3)]);
}

test("lockController: documentation example (concurrency = 1)", async () => {
  const output = new Array<string>();

  await exampleLockControllerWithConcurrency(1, output);

  expect(output[0]).toBe("Task 1 acquire the lock");
  expect(output[1]).toBe("Task 1 release the lock");
  expect(output[2]).toBe("Task 2 acquire the lock");
  expect(output[3]).toBe("Task 2 release the lock");
  expect(output[4]).toBe("Task 3 acquire the lock");
  expect(output[5]).toBe("Task 3 release the lock");
});

test("lockController: documentation example (concurrency = 2)", async () => {
  const output = new Array<string>();

  await exampleLockControllerWithConcurrency(2, output);

  expect(output[0]).toBe("Task 1 acquire the lock");
  expect(output[1]).toBe("Task 2 acquire the lock");
  expect(output[2]).toBe("Task 1 release the lock");
  expect(output[3]).toBe("Task 3 acquire the lock");
  expect(output[4]).toBe("Task 2 release the lock");
  expect(output[5]).toBe("Task 3 release the lock");
});

test("lockController: prevent concurrent access to resource (default options)", async () => {
  const resultsInOrderWithoutLock = new Array<string>();
  const promisesWithoutLock = [
    new Task("A").run(120, resultsInOrderWithoutLock),
    new Task("B").run(60, resultsInOrderWithoutLock),
    new Task("C").run(10, resultsInOrderWithoutLock),
  ];

  const lockController = new LockController();
  const resultsInOrderWithLock = new Array<string>();
  const promisesWithLock = [
    new Task("A", lockController).run(120, resultsInOrderWithLock),
    new Task("B", lockController).run(60, resultsInOrderWithLock),
    new Task("C", lockController).run(10, resultsInOrderWithLock),
  ];

  await Promise.all(promisesWithoutLock);
  await Promise.all(promisesWithLock);

  expect(resultsInOrderWithoutLock[0]).toBe("C");
  expect(resultsInOrderWithoutLock[1]).toBe("B");
  expect(resultsInOrderWithoutLock[2]).toBe("A");

  expect(resultsInOrderWithLock[0]).toBe("A");
  expect(resultsInOrderWithLock[1]).toBe("B");
  expect(resultsInOrderWithLock[2]).toBe("C");
});

test("lockController: prevent concurrent access to resource FIFO", async () => {
  const lockController = new LockController({ queueType: "FIFO" });
  const resultsInOrder = new Array<string>();
  const promises = [
    new Task("A", lockController).run(120, resultsInOrder),
    new Task("B", lockController).run(60, resultsInOrder),
    new Task("C", lockController).run(10, resultsInOrder),
  ];

  await Promise.all(promises);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("lockController: prevent concurrent access to resource LIFO", async () => {
  const lockController = new LockController({ queueType: "LIFO" });
  const resultsInOrder = new Array<string>();
  const promises = [
    new Task("A", lockController).run(120, resultsInOrder),
    new Task("B", lockController).run(60, resultsInOrder),
    new Task("C", lockController).run(10, resultsInOrder),
  ];

  await Promise.all(promises);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("C");
  expect(resultsInOrder[2]).toBe("B");
});

test("lockController: method locked true", async () => {
  const lockController = new LockController();

  await lockController.acquire();

  expect(!lockController.isAvailable()).toBe(true);
});

test("lockController: method locked true", async () => {
  const lockController = new LockController();

  const release = await lockController.acquire();
  release();

  expect(!lockController.isAvailable()).toBe(false);
});

test("lockController: release multiple times", async () => {
  const lockController = new LockController();

  const release = await lockController.acquire();
  release();
  release();

  expect(!lockController.isAvailable()).toBe(false);
});

test("lockController: method tryAcquire true", async () => {
  const lockController = new LockController();
  const { acquired } = lockController.tryAcquire();
  expect(acquired).toBe(true);
});

test("lockController: method tryAcquire false (waiting lock)", async () => {
  const lockController = new LockController();
  const promises = [new Task("A", lockController).run(120), new Task("B", lockController).run(60), new Task("C", lockController).run(10)];
  Promise.all(promises);

  const { acquired } = lockController.tryAcquire();

  expect(acquired).toBe(false);
});

test("lockController: method tryAcquire false (running lock)", async () => {
  const lockController = new LockController();
  const promises = [new Task("A", lockController).run(120)];
  Promise.all(promises);
  await setTimeout(10, undefined);

  const { acquired } = lockController.tryAcquire();

  expect(acquired).toBe(false);
});

test("lockController: listen 'lock-acquired' event", async () => {
  const lockController = new LockController();
  let lockAcquiredEventTriggered = false;
  lockController.on("lock-acquired", () => {
    lockAcquiredEventTriggered = true;
  });

  await lockController.acquire();

  expect(lockAcquiredEventTriggered).toBe(true);
});

test("lockController: listen 'lock-released' event", async () => {
  const lockController = new LockController();
  let lockReleasedEventTriggered = false;
  lockController.on("lock-released", () => {
    lockReleasedEventTriggered = true;
  });

  const release = await lockController.acquire();
  release();

  expect(lockReleasedEventTriggered).toBe(true);
});

test("lockController: event listener off", async () => {
  const lockController = new LockController();
  let lockAcquiredEventTriggered = false;
  const lockAcquiredListener = () => {
    lockAcquiredEventTriggered = true;
  };
  lockController.on("lock-acquired", lockAcquiredListener);
  lockController.off("lock-acquired", lockAcquiredListener);

  await lockController.acquire();

  expect(lockAcquiredEventTriggered).toBe(false);
});

test("lockController: releaseTimeout not reached", async () => {
  const lockController = new LockController({ releaseTimeout: 200 });
  lockController.acquire();

  const isLockedBeforeDelay = !lockController.isAvailable();
  await setTimeout(100, undefined);
  const isLockedAfterDelay = !lockController.isAvailable();

  expect(isLockedBeforeDelay).toBe(true);
  expect(isLockedAfterDelay).toBe(true);
});

test("lockController: releaseTimeout reached", async () => {
  const lockController = new LockController({ releaseTimeout: 50 });
  lockController.acquire();

  const isLockedBeforeDelay = !lockController.isAvailable();
  await setTimeout(100, undefined);
  const isLockedAfterDelay = !lockController.isAvailable();

  expect(isLockedBeforeDelay).toBe(true);
  expect(isLockedAfterDelay).toBe(false);
});

test("lockController: releaseTimeoutHandler triggered", async () => {
  let timeoutHandlerTriggered = false;
  const timeoutHandler = () => {
    timeoutHandlerTriggered = true;
  };

  const lockController = new LockController({ releaseTimeout: 50, releaseTimeoutHandler: timeoutHandler });
  lockController.acquire();

  await setTimeout(100, undefined);

  expect(timeoutHandlerTriggered).toBe(true);
});

test("lockController: releaseTimeoutHandler not triggered", async () => {
  let timeoutHandlerTriggered = false;
  const releaseTimeoutHandler = () => {
    timeoutHandlerTriggered = true;
  };

  const lockController = new LockController({ releaseTimeout: 200, releaseTimeoutHandler });
  lockController.acquire();

  await setTimeout(100, undefined);

  expect(timeoutHandlerTriggered).toBe(false);
});

test("lockController: listen 'error' event (release-timeout-handler-failure)", async () => {
  const releaseTimeoutHandler = () => {
    throw Error("unexpected error on timeoutHandler");
  };

  const lockController = new LockController({ releaseTimeout: 50, releaseTimeoutHandler });
  let errorEventTriggered = false;
  let lockEventError: LockEventError | undefined;
  lockController.on("error", (error: LockEventError) => {
    errorEventTriggered = true;
    lockEventError = error;
  });

  await lockController.acquire();
  await setTimeout(100, undefined);

  expect(errorEventTriggered).toBe(true);
  if (lockEventError !== undefined) {
    expect(lockEventError.code).toBe("release-timeout-handler-failure");
  } else {
    fail("lockEventError missed");
  }
});

test("lock pool: allow limited concurrent access to resource", async () => {
  const resultsInOrderWithoutLock = new Array<string>();
  const promisesWithoutLock = [
    new Task("A").run(120, resultsInOrderWithoutLock),
    new Task("B").run(60, resultsInOrderWithoutLock),
    new Task("C").run(10, resultsInOrderWithoutLock),
  ];

  const lockController = new LockController({ concurrency: 2 });
  const resultsInOrderWithLock = new Array<string>();
  const promisesWithLock = [
    new Task("A", lockController).run(120, resultsInOrderWithLock),
    new Task("B", lockController).run(60, resultsInOrderWithLock),
    new Task("C", lockController).run(10, resultsInOrderWithLock),
  ];

  await Promise.all(promisesWithoutLock);
  await Promise.all(promisesWithLock);

  expect(resultsInOrderWithoutLock[0]).toBe("C");
  expect(resultsInOrderWithoutLock[1]).toBe("B");
  expect(resultsInOrderWithoutLock[2]).toBe("A");

  expect(resultsInOrderWithLock[0]).toBe("B");
  expect(resultsInOrderWithLock[1]).toBe("C");
  expect(resultsInOrderWithLock[2]).toBe("A");
});

test("lock pool: default options", async () => {
  const resultsInOrderWithoutLock = new Array<string>();
  const promisesWithoutLock = [
    new Task("A").run(120, resultsInOrderWithoutLock),
    new Task("B").run(60, resultsInOrderWithoutLock),
    new Task("C").run(10, resultsInOrderWithoutLock),
  ];

  const lockController = new LockController();
  const resultsInOrderWithLock = new Array<string>();
  const promisesWithLock = [
    new Task("A", lockController).run(120, resultsInOrderWithLock),
    new Task("B", lockController).run(60, resultsInOrderWithLock),
    new Task("C", lockController).run(10, resultsInOrderWithLock),
  ];

  await Promise.all(promisesWithoutLock);
  await Promise.all(promisesWithLock);

  expect(resultsInOrderWithoutLock[0]).toBe("C");
  expect(resultsInOrderWithoutLock[1]).toBe("B");
  expect(resultsInOrderWithoutLock[2]).toBe("A");

  expect(resultsInOrderWithLock[0]).toBe("A");
  expect(resultsInOrderWithLock[1]).toBe("B");
  expect(resultsInOrderWithLock[2]).toBe("C");
});

test("lock pool: invalid options", async () => {
  const lockController = new LockController({ concurrency: "5" } as any);
  const resultsInOrder = new Array<string>();
  const promisesWithLock = [
    new Task("A", lockController).run(120, resultsInOrder),
    new Task("B", lockController).run(60, resultsInOrder),
    new Task("C", lockController).run(10, resultsInOrder),
  ];

  await Promise.all(promisesWithLock);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("lockController: releaseAcquiredLocks method (concurrent 3, running 3, waiting: 0)", async () => {
  const lockController = new LockController({ concurrency: 3 });
  lockController.acquire();
  lockController.acquire();
  lockController.acquire();

  const isLockedBeforeReleaseAll = !lockController.isAvailable();
  lockController.releaseAcquiredLocks();
  const isLockedAfterReleaseAll = !lockController.isAvailable();

  expect(isLockedBeforeReleaseAll).toBe(true);
  expect(isLockedAfterReleaseAll).toBe(false);
});

test("lockController: releaseAcquiredLocks method (concurrent 1, running 1, waiting: 1)", async () => {
  const lockController = new LockController({ concurrency: 1 });
  lockController.acquire();
  lockController.acquire();

  const isLockedBeforeReleaseAll = !lockController.isAvailable();
  lockController.releaseAcquiredLocks();
  const isLockedAfterReleaseAll = !lockController.isAvailable();

  expect(isLockedBeforeReleaseAll).toBe(true);
  expect(isLockedAfterReleaseAll).toBe(true);
});

test("lockController: releaseAcquiredLocks method (concurrent 1, running 0, waiting: 0)", async () => {
  const lockController = new LockController({ concurrency: 1 });

  const isLockedBeforeReleaseAll = !lockController.isAvailable();
  lockController.releaseAcquiredLocks();
  const isLockedAfterReleaseAll = !lockController.isAvailable();

  expect(isLockedBeforeReleaseAll).toBe(false);
  expect(isLockedAfterReleaseAll).toBe(false);
});
