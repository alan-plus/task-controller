import { setTimeout } from "timers/promises";
import { PromiseMutex } from "../../src/task-executors/promise-mutex";

function task(result: string, timeout: number, resultsInOrder?: string[]): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    await setTimeout(timeout, undefined);

    if (resultsInOrder) {
      resultsInOrder.push(result);
    }
    resolve(result);
  });
}

test("promise mutex: prevent concurrent task execution (default options)", async () => {
  const taskExecutor = new PromiseMutex<string>();
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([() => task("A", 120, resultsInOrder), () => task("B", 60, resultsInOrder), () => task("C", 10, resultsInOrder)]);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("promise mutex: prevent concurrent task execution FIFO", async () => {
  const abortController = new AbortController();
  const taskExecutor = new PromiseMutex<string>({ queueType: "FIFO", signal: abortController.signal });
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([() => task("A", 120, resultsInOrder), () => task("B", 60, resultsInOrder), () => task("C", 10, resultsInOrder)]);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("promise mutex: prevent concurrent task execution LIFO", async () => {
  const taskExecutor = new PromiseMutex<string>({ queueType: "LIFO" });
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([() => task("A", 120, resultsInOrder), () => task("B", 60, resultsInOrder), () => task("C", 10, resultsInOrder)]);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("C");
  expect(resultsInOrder[2]).toBe("B");
});

test("promise mutex: method run", async () => {
  const taskExecutor = new PromiseMutex<string>();
  const resultsInOrder = new Array<string>();

  taskExecutor.run(() => task("A", 120, resultsInOrder));
  taskExecutor.run(() => task("B", 60, resultsInOrder));
  taskExecutor.run(() => task("C", 10, resultsInOrder));

  await setTimeout(250, undefined);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});
