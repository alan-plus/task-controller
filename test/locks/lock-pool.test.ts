import { setTimeout } from 'timers/promises';
import { LockPool } from '../../src/locks/lock-pool';
import { Lock } from '../../src/interfaces/lock';

class Task {
  constructor(
    private readonly result: string,
    private readonly lock?: Lock
  ) {}

  public async run(timeout: number, resultsInOrder: string[]): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      try {
        if (this.lock) {
          await this.lock.lock();
        }

        await setTimeout(timeout, undefined);

        resultsInOrder.push(this.result);
        resolve(this.result);
      } finally {
        if (this.lock) {
          this.lock.unlock();
        }
      }
    });
  }
}

test("lock pool: allow limited concurrent access to resource", async () => {
  const resultsInOrderWithoutLock = new Array<string>();
  const promisesWithoutLock = [
    new Task("A").run(30, resultsInOrderWithoutLock), 
    new Task("B").run(20, resultsInOrderWithoutLock), 
    new Task("C").run(10, resultsInOrderWithoutLock)
  ];

  const lock = new LockPool({concurrentLimit: 2});
  const resultsInOrderWithLock = new Array<string>();
  const promisesWithLock = [
    new Task("A", lock).run(30, resultsInOrderWithLock), 
    new Task("B", lock).run(20, resultsInOrderWithLock),
    new Task("C", lock).run(10, resultsInOrderWithLock)
  ];

  await Promise.all(promisesWithoutLock);
  await Promise.all(promisesWithLock);

  expect(resultsInOrderWithoutLock[0]).toBe("C");
  expect(resultsInOrderWithoutLock[1]).toBe("B");
  expect(resultsInOrderWithoutLock[2]).toBe("A");

  expect(resultsInOrderWithLock[0]).toBe("B");
  expect(resultsInOrderWithLock[1]).toBe("A");
  expect(resultsInOrderWithLock[2]).toBe("C");
});