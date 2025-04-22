import { setTimeout } from 'timers/promises';
import { PromisePool } from '../../src/task-executors/promise-pool';

function task(result: string, timeout: number, resultsInOrder: string[]): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      await setTimeout(timeout, undefined);

      resultsInOrder.push(result);
      resolve(result);
    });
}

test("promise pool: allow limited concurrent task execution", async () => {
  const taskExecutor = new PromisePool<string>({concurrentLimit: 2});
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([() => task("A", 120, resultsInOrder), () => task("B", 60, resultsInOrder), () => task("C", 10, resultsInOrder)]);

  expect(resultsInOrder[0]).toBe("B");
  expect(resultsInOrder[1]).toBe("C");
  expect(resultsInOrder[2]).toBe("A");
});