import { setTimeout } from "timers/promises";
import { LockController } from "../../src/locks/lock-controller";
import { LockEventError, ReleaseFunction } from "../../src/locks/lock-controller.type";

class Task {
  constructor(
    private readonly result: string,
    private readonly lock?: LockController
  ) {}

  public async run(timeout: number, resultsInOrder?: string[]): Promise<string> {
    return new Promise<string>(async (resolve) => {
      let release: ReleaseFunction | undefined;
      try {
        if (this.lock) {
          release = await this.lock.acquire();
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

test("lockController: prevent concurrent access to resource (default options)", async () => {
  const resultsInOrderWithoutLock = new Array<string>();
  const promisesWithoutLock = [
    new Task("A").run(120, resultsInOrderWithoutLock),
    new Task("B").run(60, resultsInOrderWithoutLock),
    new Task("C").run(10, resultsInOrderWithoutLock),
  ];

  const lock = new LockController();
  const resultsInOrderWithLock = new Array<string>();
  const promisesWithLock = [
    new Task("A", lock).run(120, resultsInOrderWithLock),
    new Task("B", lock).run(60, resultsInOrderWithLock),
    new Task("C", lock).run(10, resultsInOrderWithLock),
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
  const lock = new LockController({ queueType: "FIFO" });
  const resultsInOrder = new Array<string>();
  const promises = [
    new Task("A", lock).run(120, resultsInOrder),
    new Task("B", lock).run(60, resultsInOrder),
    new Task("C", lock).run(10, resultsInOrder),
  ];

  await Promise.all(promises);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("lockController: prevent concurrent access to resource LIFO", async () => {
  const lock = new LockController({ queueType: "LIFO" });
  const resultsInOrder = new Array<string>();
  const promises = [
    new Task("A", lock).run(120, resultsInOrder),
    new Task("B", lock).run(60, resultsInOrder),
    new Task("C", lock).run(10, resultsInOrder),
  ];

  await Promise.all(promises);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("C");
  expect(resultsInOrder[2]).toBe("B");
});

test("lockController: method locked true", async () => {
  const lock = new LockController();

  await lock.acquire();

  expect(!lock.isAvailable()).toBe(true);
});

test("lockController: method locked true", async () => {
  const lock = new LockController();

  const release = await lock.acquire();
  release();

  expect(!lock.isAvailable()).toBe(false);
});

test("lockController: release multiple times", async () => {
  const lock = new LockController();

  const release = await lock.acquire();
  release();
  release();

  expect(!lock.isAvailable()).toBe(false);
});

test("lockController: method tryAcquire true", async () => {
  const lock = new LockController();
  const { acquired } = lock.tryAcquire();
  expect(acquired).toBe(true);
});

test("lockController: method tryAcquire false (waiting lock)", async () => {
  const lock = new LockController();
  const promises = [new Task("A", lock).run(120), new Task("B", lock).run(60), new Task("C", lock).run(10)];
  Promise.all(promises);

  const { acquired } = lock.tryAcquire();

  expect(acquired).toBe(false);
});

test("lockController: method tryAcquire false (running lock)", async () => {
  const lock = new LockController();
  const promises = [new Task("A", lock).run(120)];
  Promise.all(promises);
  await setTimeout(10, undefined);

  const { acquired } = lock.tryAcquire();

  expect(acquired).toBe(false);
});

test("lockController: listen 'lock-acquired' event", async () => {
  const lock = new LockController();
  let lockAcquiredEventTriggered = false;
  lock.on("lock-acquired", () => {
    lockAcquiredEventTriggered = true;
  });

  await lock.acquire();

  expect(lockAcquiredEventTriggered).toBe(true);
});

test("lockController: listen 'lock-released' event", async () => {
  const lock = new LockController();
  let lockReleasedEventTriggered = false;
  lock.on("lock-released", () => {
    lockReleasedEventTriggered = true;
  });

  const release = await lock.acquire();
  release();

  expect(lockReleasedEventTriggered).toBe(true);
});

test("lockController: event listener off", async () => {
  const lock = new LockController();
  let lockAcquiredEventTriggered = false;
  const lockAcquiredListener = () => {
    lockAcquiredEventTriggered = true;
  };
  lock.on("lock-acquired", lockAcquiredListener);
  lock.off("lock-acquired", lockAcquiredListener);

  await lock.acquire();

  expect(lockAcquiredEventTriggered).toBe(false);
});

test("lockController: releaseTimeout not reached", async () => {
  const lock = new LockController({ releaseTimeout: 200 });
  lock.acquire();

  const isLockedBeforeDelay = !lock.isAvailable();
  await setTimeout(100, undefined);
  const isLockedAfterDelay = !lock.isAvailable();

  expect(isLockedBeforeDelay).toBe(true);
  expect(isLockedAfterDelay).toBe(true);
});

test("lockController: releaseTimeout reached", async () => {
  const lock = new LockController({ releaseTimeout: 50 });
  lock.acquire();

  const isLockedBeforeDelay = !lock.isAvailable();
  await setTimeout(100, undefined);
  const isLockedAfterDelay = !lock.isAvailable();

  expect(isLockedBeforeDelay).toBe(true);
  expect(isLockedAfterDelay).toBe(false);
});

test("lockController: releaseTimeoutHandler triggered", async () => {
  let timeoutHandlerTriggered = false;
  const timeoutHandler = () => {
    timeoutHandlerTriggered = true;
  };

  const lock = new LockController({ releaseTimeout: 50, releaseTimeoutHandler: timeoutHandler });
  lock.acquire();

  await setTimeout(100, undefined);

  expect(timeoutHandlerTriggered).toBe(true);
});

test("lockController: releaseTimeoutHandler not triggered", async () => {
  let timeoutHandlerTriggered = false;
  const releaseTimeoutHandler = () => {
    timeoutHandlerTriggered = true;
  };

  const lock = new LockController({ releaseTimeout: 200, releaseTimeoutHandler });
  lock.acquire();

  await setTimeout(100, undefined);

  expect(timeoutHandlerTriggered).toBe(false);
});

test("lockController: listen 'error' event (release-timeout-handler-failure)", async () => {
  const releaseTimeoutHandler = () => {
    throw Error("unexpected error on timeoutHandler");
  };

  const lock = new LockController({ releaseTimeout: 50, releaseTimeoutHandler });
  let errorEventTriggered = false;
  let lockEventError: LockEventError | undefined;
  lock.on("error", (error: LockEventError) => {
    errorEventTriggered = true;
    lockEventError = error;
  });

  await lock.acquire();
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

  const lock = new LockController({ concurrentLimit: 2 });
  const resultsInOrderWithLock = new Array<string>();
  const promisesWithLock = [
    new Task("A", lock).run(120, resultsInOrderWithLock),
    new Task("B", lock).run(60, resultsInOrderWithLock),
    new Task("C", lock).run(10, resultsInOrderWithLock),
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

  const lock = new LockController();
  const resultsInOrderWithLock = new Array<string>();
  const promisesWithLock = [
    new Task("A", lock).run(120, resultsInOrderWithLock),
    new Task("B", lock).run(60, resultsInOrderWithLock),
    new Task("C", lock).run(10, resultsInOrderWithLock),
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
  const lock = new LockController({ concurrentLimit: "5" } as any);
  const resultsInOrder = new Array<string>();
  const promisesWithLock = [
    new Task("A", lock).run(120, resultsInOrder),
    new Task("B", lock).run(60, resultsInOrder),
    new Task("C", lock).run(10, resultsInOrder),
  ];

  await Promise.all(promisesWithLock);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("lock pool: example code", async () => {
  const lock = new LockController({ concurrentLimit: 2 });
  const initTimestamp = Date.now();

  const results = await Promise.all([
    new Promise<any>(async (resolve) => {
      const release = await lock.acquire();
      const accessToLockTimestamp = Date.now();
      try {
        // access the resource for 150 miliseconds
        await setTimeout(150, undefined);

        resolve({ task: "A", timeToAccessTheLock: accessToLockTimestamp - initTimestamp });
      } finally {
        release();
      }
    }),
    new Promise<any>(async (resolve) => {
      const release = await lock.acquire();
      const accessToLockTimestamp = Date.now();
      try {
        // access the resource for 100 miliseconds
        await setTimeout(100, undefined);

        resolve({ task: "B", timeToAccessTheLock: accessToLockTimestamp - initTimestamp });
      } finally {
        release();
      }
    }),
    new Promise<any>(async (resolve) => {
      const release = await lock.acquire();
      const accessToLockTimestamp = Date.now();
      try {
        // access the resource protected by this lock

        resolve({ task: "C", timeToAccessTheLock: accessToLockTimestamp - initTimestamp });
      } finally {
        release();
      }
    }),
  ]);

  expect(results[0].timeToAccessTheLock).toBeLessThan(10);
  expect(results[1].timeToAccessTheLock).toBeLessThan(10);
  expect(results[2].timeToAccessTheLock).toBeGreaterThanOrEqual(100);
});

test("lockController: releaseAcquiredLocks method (concurrent 3, running 3, waiting: 0)", async () => {
  const lock = new LockController({ concurrentLimit: 3 });
  lock.acquire();
  lock.acquire();
  lock.acquire();

  const isLockedBeforeReleaseAll = !lock.isAvailable();
  lock.releaseAcquiredLocks();
  const isLockedAfterReleaseAll = !lock.isAvailable();

  expect(isLockedBeforeReleaseAll).toBe(true);
  expect(isLockedAfterReleaseAll).toBe(false);
});

test("lockController: releaseAcquiredLocks method (concurrent 1, running 1, waiting: 1)", async () => {
  const lock = new LockController({ concurrentLimit: 1 });
  lock.acquire();
  lock.acquire();

  const isLockedBeforeReleaseAll = !lock.isAvailable();
  lock.releaseAcquiredLocks();
  const isLockedAfterReleaseAll = !lock.isAvailable();

  expect(isLockedBeforeReleaseAll).toBe(true);
  expect(isLockedAfterReleaseAll).toBe(true);
});

test("lockController: releaseAcquiredLocks method (concurrent 1, running 0, waiting: 0)", async () => {
  const lock = new LockController({ concurrentLimit: 1 });

  const isLockedBeforeReleaseAll = !lock.isAvailable();
  lock.releaseAcquiredLocks();
  const isLockedAfterReleaseAll = !lock.isAvailable();

  expect(isLockedBeforeReleaseAll).toBe(false);
  expect(isLockedAfterReleaseAll).toBe(false);
});
