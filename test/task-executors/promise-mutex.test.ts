import { setTimeout } from 'timers/promises';
import { PromiseMutex } from '../../src/task-executors/promise-mutex';

function task(result: string, timeout: number): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      await setTimeout(timeout, undefined);
      
      resolve(result);
    });
}

test("promise mutex: prevent concurrent task execution", async () => {
  const taskExecutor = new PromiseMutex<string>();

  const results = await taskExecutor.runMany([() => task("A", 120), () => task("B", 60), () => task("C", 10)]);

  expect(results[0]).toBe("A");
  expect(results[1]).toBe("B");
  expect(results[2]).toBe("C");
});