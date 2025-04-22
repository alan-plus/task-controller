import { setTimeout } from "timers/promises";
import { PromisePool } from "../../src/task-executors/promise-pool";

function task(result: string, timeout: number, resultsInOrder: string[]): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    await setTimeout(timeout, undefined);

    resultsInOrder.push(result);
    resolve(result);
  });
}

test("promise pool: allow limited concurrent task execution", async () => {
  const taskExecutor = new PromisePool<string>({ concurrentLimit: 2 });
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([() => task("A", 120, resultsInOrder), () => task("B", 60, resultsInOrder), () => task("C", 10, resultsInOrder)]);

  expect(resultsInOrder[0]).toBe("B");
  expect(resultsInOrder[1]).toBe("C");
  expect(resultsInOrder[2]).toBe("A");
});

test("promise pool: default options", async () => {
  const taskExecutor = new PromisePool<string>();
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([() => task("A", 120, resultsInOrder), () => task("B", 60, resultsInOrder), () => task("C", 10, resultsInOrder)]);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("promise pool: invalid options", async () => {
  const taskExecutor = new PromisePool<string>({ concurrentLimit: "5" } as any);
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([() => task("A", 120, resultsInOrder), () => task("B", 60, resultsInOrder), () => task("C", 10, resultsInOrder)]);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("promise pool: method run", async () => {
  const taskExecutor = new PromisePool<string>({ concurrentLimit: 2 });
  const resultsInOrder = new Array<string>();

  taskExecutor.run(() => task("A", 120, resultsInOrder));
  taskExecutor.run(() => task("B", 60, resultsInOrder));
  taskExecutor.run(() => task("C", 10, resultsInOrder));

  await setTimeout(250, undefined);

  expect(resultsInOrder[0]).toBe("B");
  expect(resultsInOrder[1]).toBe("C");
  expect(resultsInOrder[2]).toBe("A");
});
