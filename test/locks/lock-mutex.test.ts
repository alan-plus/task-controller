import { setTimeout } from "timers/promises";
import { LockMutex } from "../../src/locks/lock-mutex";
import { Lock } from "../../src/interfaces/lock";
import { ReleaseFunction } from "../../src/interfaces/release-function";

class Task {
  constructor(
    private readonly result: string,
    private readonly lock?: Lock
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

test("lock mutex: prevent concurrent access to resource (default options)", async () => {
  const resultsInOrderWithoutLock = new Array<string>();
  const promisesWithoutLock = [
    new Task("A").run(120, resultsInOrderWithoutLock),
    new Task("B").run(60, resultsInOrderWithoutLock),
    new Task("C").run(10, resultsInOrderWithoutLock),
  ];

  const lock = new LockMutex();
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

test("lock mutex: prevent concurrent access to resource FIFO", async () => {
  const lock = new LockMutex({ queueType: "FIFO" });
  const resultsInOrder = new Array<string>();
  const promises = [new Task("A", lock).run(120, resultsInOrder), new Task("B", lock).run(60, resultsInOrder), new Task("C", lock).run(10, resultsInOrder)];

  await Promise.all(promises);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("lock mutex: prevent concurrent access to resource LIFO", async () => {
  const lock = new LockMutex({ queueType: "LIFO" });
  const resultsInOrder = new Array<string>();
  const promises = [new Task("A", lock).run(120, resultsInOrder), new Task("B", lock).run(60, resultsInOrder), new Task("C", lock).run(10, resultsInOrder)];

  await Promise.all(promises);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("C");
  expect(resultsInOrder[2]).toBe("B");
});

test("lock: method locked", async () => {
  const lock = new LockMutex();

  await lock.acquire();

  expect(lock.locked()).toBe(true);
});

test("lock: function release", async () => {
  const lock = new LockMutex();

  const release = await lock.acquire();
  release();

  expect(lock.locked()).toBe(false);
});

test("lock: release multiple times", async () => {
  const lock = new LockMutex();

  const release = await lock.acquire();
  release();
  release();

  expect(lock.locked()).toBe(false);
});

test("lock: method tryAcquire true", async () => {
  const lock = new LockMutex();
  const { acquired } = lock.tryAcquire();
  expect(acquired).toBe(true);
});

test("lock: method tryAcquire false (waiting lock)", async () => {
  const lock = new LockMutex();
  const promises = [new Task("A", lock).run(120), new Task("B", lock).run(60), new Task("C", lock).run(10)];
  Promise.all(promises);

  const { acquired } = lock.tryAcquire();

  expect(acquired).toBe(false);
});

test("lock: method tryAcquire false (running lock)", async () => {
  const lock = new LockMutex();
  const promises = [new Task("A", lock).run(120)];
  Promise.all(promises);
  await setTimeout(10, undefined);

  const { acquired } = lock.tryAcquire();

  expect(acquired).toBe(false);
});
