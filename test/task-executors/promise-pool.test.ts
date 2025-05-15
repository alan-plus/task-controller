import { setTimeout } from "timers/promises";
import { PromisePool } from "../../src/task-executors/promise-pool";

function task(result: string, timeout: number, resultsInOrder?: string[]): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    await setTimeout(timeout, undefined);

    if (resultsInOrder) {
      resultsInOrder.push(result);
    }

    resolve(result);
  });
}

test("taskExecutor: allow limited concurrent task execution", async () => {
  const taskExecutor = new PromisePool<string>({ concurrentLimit: 2 });
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([
    () => task("A", 120, resultsInOrder),
    () => task("B", 60, resultsInOrder),
    () => task("C", 10, resultsInOrder),
  ]);

  expect(resultsInOrder[0]).toBe("B");
  expect(resultsInOrder[1]).toBe("C");
  expect(resultsInOrder[2]).toBe("A");
});

test("taskExecutor: runMany arguments", async () => {
  const taskExecutor = new PromisePool<string>({ concurrentLimit: 2 });
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany(
    [(arg) => task(arg, 120, resultsInOrder), (arg) => task(arg, 60, resultsInOrder), (arg) => task(arg, 10, resultsInOrder)],
    ["A", "B"]
  );

  expect(resultsInOrder[0]).toBe("B");
  expect(resultsInOrder[1]).toBe(undefined);
  expect(resultsInOrder[2]).toBe("A");
});

test("taskExecutor: default options", async () => {
  const taskExecutor = new PromisePool<string>();
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([
    () => task("A", 120, resultsInOrder),
    () => task("B", 60, resultsInOrder),
    () => task("C", 10, resultsInOrder),
  ]);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("taskExecutor: invalid options", async () => {
  const taskExecutor = new PromisePool<string>({ concurrentLimit: "5" } as any);
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([
    () => task("A", 120, resultsInOrder),
    () => task("B", 60, resultsInOrder),
    () => task("C", 10, resultsInOrder),
  ]);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("taskExecutor: method run", async () => {
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

test("taskExecutor: changeConcurrentLimit (PromisePool)", async () => {
  const taskExecutor = new PromisePool<string>({ concurrentLimit: 1 });
  taskExecutor.run(() => task("A", 120));

  const runningLimitReachedBeforeChangeConcurrentLimit = taskExecutor.isRunningLimitReached();
  taskExecutor.changeConcurrentLimit(2);
  const runningLimitReachedAfterChangeConcurrentLimit = taskExecutor.isRunningLimitReached();

  expect(runningLimitReachedBeforeChangeConcurrentLimit).toBe(true);
  expect(runningLimitReachedAfterChangeConcurrentLimit).toBe(false);
});

test("taskExecutor: concurrentLimit (NaN)", async () => {
  const taskExecutor = new PromisePool<string>({ concurrentLimit: NaN });

  const runningLimitReachedBeforeRuntask = taskExecutor.isRunningLimitReached();
  taskExecutor.run(() => task("A", 120));
  const runningLimitReachedAfterRuntask = taskExecutor.isRunningLimitReached();

  expect(runningLimitReachedBeforeRuntask).toBe(false);
  expect(runningLimitReachedAfterRuntask).toBe(true);
});

test("taskExecutor: concurrentLimit (Infinity)", async () => {
  const taskExecutor = new PromisePool<string>({ concurrentLimit: Infinity });

  const runningLimitReachedBeforeRuntask = taskExecutor.isRunningLimitReached();
  taskExecutor.run(() => task("A", 120));
  const runningLimitReachedAfterRuntask = taskExecutor.isRunningLimitReached();

  expect(runningLimitReachedBeforeRuntask).toBe(false);
  expect(runningLimitReachedAfterRuntask).toBe(true);
});

test("taskExecutor: concurrentLimit (Infinity)", async () => {
  const taskExecutor = new PromisePool<string>({ concurrentLimit: 0.9 });

  const runningLimitReachedBeforeRuntask = taskExecutor.isRunningLimitReached();
  taskExecutor.run(() => task("A", 120));
  const runningLimitReachedAfterRuntask = taskExecutor.isRunningLimitReached();

  expect(runningLimitReachedBeforeRuntask).toBe(false);
  expect(runningLimitReachedAfterRuntask).toBe(true);
});

test("taskExecutor: changeConcurrentLimit (null)", async () => {
  const taskExecutor = new PromisePool<string>();
  taskExecutor.changeConcurrentLimit(null as unknown as number);

  const runningLimitReachedBeforeRuntask = taskExecutor.isRunningLimitReached();
  taskExecutor.run(() => task("A", 120));
  const runningLimitReachedAfterRuntask = taskExecutor.isRunningLimitReached();

  expect(runningLimitReachedBeforeRuntask).toBe(false);
  expect(runningLimitReachedAfterRuntask).toBe(true);
});

test("taskExecutor: changeConcurrentLimit (NaN)", async () => {
  const taskExecutor = new PromisePool<string>();
  taskExecutor.changeConcurrentLimit(NaN);

  const runningLimitReachedBeforeRuntask = taskExecutor.isRunningLimitReached();
  taskExecutor.run(() => task("A", 120));
  const runningLimitReachedAfterRuntask = taskExecutor.isRunningLimitReached();

  expect(runningLimitReachedBeforeRuntask).toBe(false);
  expect(runningLimitReachedAfterRuntask).toBe(true);
});

test("taskExecutor: changeConcurrentLimit (0)", async () => {
  const taskExecutor = new PromisePool<string>();
  taskExecutor.changeConcurrentLimit(0);

  const runningLimitReachedBeforeRuntask = taskExecutor.isRunningLimitReached();
  taskExecutor.run(() => task("A", 120));
  const runningLimitReachedAfterRuntask = taskExecutor.isRunningLimitReached();

  expect(runningLimitReachedBeforeRuntask).toBe(false);
  expect(runningLimitReachedAfterRuntask).toBe(true);
});
