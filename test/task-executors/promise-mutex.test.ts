import { setTimeout } from "timers/promises";
import { PromiseMutex } from "../../src/task-executors/promise-mutex";
import { ReleaseBeforeFinishReason } from "../../src/task-executors/promise-pool";

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

  await taskExecutor.runMany([
    () => task("A", 120, resultsInOrder),
    () => task("B", 60, resultsInOrder),
    () => task("C", 10, resultsInOrder),
  ]);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("promise mutex: prevent concurrent task execution FIFO", async () => {
  const abortController = new AbortController();
  const taskExecutor = new PromiseMutex<string>({ queueType: "FIFO", signal: abortController.signal });
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

test("promise mutex: prevent concurrent task execution LIFO", async () => {
  const taskExecutor = new PromiseMutex<string>({ queueType: "LIFO" });
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([
    () => task("A", 120, resultsInOrder),
    () => task("B", 60, resultsInOrder),
    () => task("C", 10, resultsInOrder),
  ]);

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

test("promise mutex: listen 'task-started' even", async () => {
  const taskExecutor = new PromiseMutex<string>();
  let taskStartedEventTriggered = false;
  taskExecutor.on("task-started", () => {
    taskStartedEventTriggered = true;
  });

  taskExecutor.run(() => task("A", 120));

  expect(taskStartedEventTriggered).toBe(true);
});

test("promise mutex: event listener off", async () => {
  const taskExecutor = new PromiseMutex<string>();
  let taskStartedEventTriggered = false;
  const lockAcquiredListener = () => {
    taskStartedEventTriggered = true;
  };
  taskExecutor.on("task-started", lockAcquiredListener);
  taskExecutor.off("task-started", lockAcquiredListener);

  taskExecutor.run(() => task("A", 120));

  expect(taskStartedEventTriggered).toBe(false);
});

test("promise mutex: listen 'task-finished' even", async () => {
  const taskExecutor = new PromiseMutex<string>();
  let taskFinishedEventTriggered = false;
  taskExecutor.on("task-finished", () => {
    taskFinishedEventTriggered = true;
  });

  taskExecutor.run(() => task("A", 10));
  await setTimeout(30, undefined);

  expect(taskFinishedEventTriggered).toBe(true);
});

test("promise mutex: listen 'task-failure' even", async () => {
  const taskExecutor = new PromiseMutex<string>();
  let taskFailureEventTriggered = false;
  let taskFailureErrorMessage: string | undefined;
  taskExecutor.on("task-failure", (taskEntry, error) => {
    taskFailureEventTriggered = true;
    taskFailureErrorMessage = error.message;
  });

  taskExecutor.run(() => {
    throw new Error("task_failed");
  });

  await setTimeout(30, undefined);

  expect(taskFailureEventTriggered).toBe(true);
  if (taskFailureErrorMessage !== undefined) {
    expect(taskFailureErrorMessage).toBe("task_failed");
  } else {
    fail("taskFailureErrorMessage missed");
  }
});

test("promise mutex: listen 'task-released-before-finished' even (release-timeout)", async () => {
  const taskExecutor = new PromiseMutex<string>({ releaseTimeout: 10 });
  let taskReleasedBeforeFinishedEventTriggered = false;
  let releaseReason: ReleaseBeforeFinishReason | undefined;
  taskExecutor.on("task-released-before-finished", (taskEntry) => {
    taskReleasedBeforeFinishedEventTriggered = true;
    releaseReason = taskEntry.releaseReason;
  });

  taskExecutor.run(() => task("A", 100));
  await setTimeout(20, undefined);

  expect(taskReleasedBeforeFinishedEventTriggered).toBe(true);
  if (releaseReason !== undefined) {
    expect(releaseReason).toBe("timeoutReached");
  } else {
    fail("releaseReason missed");
  }
});


