import { setTimeout } from 'timers/promises';
import { SimpleLock } from '../../src/locks/simple-lock';

class Task {
  constructor(
    private readonly result: string,
    private readonly lock?: SimpleLock
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

test("simple lock prevent concurrent access to resource", async () => {
  const resultsInOrderWithoutLock = new Array<string>();
  const promisesWithoutLock = [new Task("A").run(30, resultsInOrderWithoutLock), new Task("B").run(10, resultsInOrderWithoutLock)];

  const lock = new SimpleLock();
  const resultsInOrderWithLock = new Array<string>();
  const promisesWithLock = [new Task("A", lock).run(30, resultsInOrderWithLock), new Task("B", lock).run(10, resultsInOrderWithLock)];

  await Promise.all(promisesWithoutLock);
  await Promise.all(promisesWithLock);

  expect(resultsInOrderWithoutLock[0]).toBe("B");
  expect(resultsInOrderWithoutLock[1]).toBe("A");

  expect(resultsInOrderWithLock[0]).toBe("A");
  expect(resultsInOrderWithLock[1]).toBe("B");
});