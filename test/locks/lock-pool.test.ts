import { setTimeout } from "timers/promises";
import { LockPool } from "../../src/locks/lock-pool";
import { Lock } from "../../src/interfaces/lock";
import { ReleaseFunction } from "../../src/interfaces/release-function";

class Task {
  constructor(
    private readonly result: string,
    private readonly lock?: Lock
  ) {}

  public async run(timeout: number, resultsInOrder: string[]): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      let release: ReleaseFunction | undefined;
      try {
        if (this.lock) {
          release = await this.lock.acquire();
        }
        await setTimeout(timeout, undefined);

        resultsInOrder.push(this.result);
        resolve(this.result);
      } finally {
        if (release) {
          release();
        }
      }
    });
  }
}

test("lock pool: allow limited concurrent access to resource", async () => {
  const resultsInOrderWithoutLock = new Array<string>();
  const promisesWithoutLock = [
    new Task("A").run(120, resultsInOrderWithoutLock),
    new Task("B").run(60, resultsInOrderWithoutLock),
    new Task("C").run(10, resultsInOrderWithoutLock),
  ];

  const lock = new LockPool({ concurrentLimit: 2 });
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

  const lock = new LockPool();
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
  const lock = new LockPool({ concurrentLimit: "5" } as any);
  const resultsInOrder = new Array<string>();
  const promisesWithLock = [new Task("A", lock).run(120, resultsInOrder), new Task("B", lock).run(60, resultsInOrder), new Task("C", lock).run(10, resultsInOrder)];

  await Promise.all(promisesWithLock);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("lock pool: example code", async () => {
  const lock = new LockPool({ concurrentLimit: 2 });
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
  expect(results[2].timeToAccessTheLock).toBeGreaterThan(100);
});
