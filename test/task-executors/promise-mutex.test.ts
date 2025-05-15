import { setTimeout } from "timers/promises";
import { PromiseMutex } from "../../src/task-executors/promise-mutex";
import { TaskEntry } from "../../src/interfaces/task.executor";
import { ReleaseBeforeFinishReason, DiscardReason, TaskEventError } from "../../src/types/promise-options.type";

function task(result: string, timeout: number, resultsInOrder?: string[]): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    await setTimeout(timeout, undefined);

    if (resultsInOrder) {
      resultsInOrder.push(result);
    }
    resolve(result);
  });
}

test("taskExecutor: prevent concurrent task execution (default options)", async () => {
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

test("taskExecutor: prevent concurrent task execution FIFO", async () => {
  const taskExecutor = new PromiseMutex<string>({ queueType: "FIFO" });
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

test("taskExecutor: prevent concurrent task execution LIFO", async () => {
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

test("taskExecutor: method run", async () => {
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

test("taskExecutor: listen 'task-started' even", async () => {
  const taskExecutor = new PromiseMutex<string>();
  let taskStartedEventTriggered = false;
  taskExecutor.on("task-started", () => {
    taskStartedEventTriggered = true;
  });

  taskExecutor.run(() => task("A", 120));

  expect(taskStartedEventTriggered).toBe(true);
});

test("taskExecutor: event listener off", async () => {
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

test("taskExecutor: listen 'task-finished' even", async () => {
  const taskExecutor = new PromiseMutex<string>();
  let taskFinishedEventTriggered = false;
  taskExecutor.on("task-finished", () => {
    taskFinishedEventTriggered = true;
  });

  taskExecutor.run(() => task("A", 10));
  await setTimeout(30, undefined);

  expect(taskFinishedEventTriggered).toBe(true);
});

test("taskExecutor: listen 'task-failure' even", async () => {
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

test("taskExecutor: listen 'task-released-before-finished' even (release-timeout)", async () => {
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

test("taskExecutor: listen 'task-released-before-finished' even (forced)", async () => {
  const taskExecutor = new PromiseMutex<string>();
  let taskReleasedBeforeFinishedEventTriggered = false;
  let releaseReason: ReleaseBeforeFinishReason | undefined;
  taskExecutor.on("task-released-before-finished", (taskEntry) => {
    taskReleasedBeforeFinishedEventTriggered = true;
    releaseReason = taskEntry.releaseReason;
  });

  taskExecutor.run(() => task("A", 100));
  taskExecutor.releaseRunningTasks();

  expect(taskReleasedBeforeFinishedEventTriggered).toBe(true);
  if (releaseReason !== undefined) {
    expect(releaseReason).toBe("forced");
  } else {
    fail("releaseReason missed");
  }
});

test("taskExecutor: listen 'task-discarded' even (timeoutReached)", async () => {
  const taskExecutor = new PromiseMutex<string>({ waitingTimeout: 30 });
  let taskDiscardedEventTriggered = false;
  let discardReason: DiscardReason | undefined;
  let discardedTaskArg: string | undefined;
  taskExecutor.on("task-discarded", (taskEntry) => {
    taskDiscardedEventTriggered = true;
    discardReason = taskEntry.discardReason;
    discardedTaskArg = taskEntry.arg;
  });

  taskExecutor.run((arg) => task(arg, 100), "A");
  taskExecutor.run((arg) => task(arg, 100), "B");

  await setTimeout(50, undefined);

  expect(taskDiscardedEventTriggered).toBe(true);
  if (discardReason !== undefined) {
    expect(discardReason).toBe("timeoutReached");
  } else {
    fail("discardReason missed");
  }
  if (discardedTaskArg !== undefined) {
    expect(discardedTaskArg).toBe("B");
  } else {
    fail("discardedTaskArg missed");
  }
});

test("taskExecutor: listen 'task-discarded' even (forced)", async () => {
  const taskExecutor = new PromiseMutex<string>();
  let taskDiscardedEventTriggered = false;
  let discardReason: DiscardReason | undefined;
  let discardedTaskArg: string | undefined;
  taskExecutor.on("task-discarded", (taskEntry) => {
    taskDiscardedEventTriggered = true;
    discardReason = taskEntry.discardReason;
    discardedTaskArg = taskEntry.arg;
  });

  taskExecutor.run((arg) => task(arg, 100), "A");
  taskExecutor.run((arg) => task(arg, 100), "B");

  await setTimeout(10, undefined);

  taskExecutor.flushPendingTasks();

  expect(taskDiscardedEventTriggered).toBe(true);
  if (discardReason !== undefined) {
    expect(discardReason).toBe("forced");
  } else {
    fail("discardReason missed");
  }
  if (discardedTaskArg !== undefined) {
    expect(discardedTaskArg).toBe("B");
  } else {
    fail("discardedTaskArg missed");
  }
});

test("taskExecutor: listen 'task-discarded' even (abortSignal)", async () => {
  const abortController = new AbortController();

  const taskExecutor = new PromiseMutex<string>({ signal: abortController.signal });
  let taskDiscardedEventTriggered = false;
  let discardReason: DiscardReason | undefined;
  let discardedTaskArg: string | undefined;
  taskExecutor.on("task-discarded", (taskEntry) => {
    taskDiscardedEventTriggered = true;
    discardReason = taskEntry.discardReason;
    discardedTaskArg = taskEntry.arg;
  });

  taskExecutor.run((arg) => task(arg, 20), "A");
  taskExecutor.run((arg) => task(arg, 100), "B");

  await setTimeout(15, undefined);
  abortController.abort();
  await setTimeout(15, undefined);

  expect(taskDiscardedEventTriggered).toBe(true);
  if (discardReason !== undefined) {
    expect(discardReason).toBe("abortSignal");
  } else {
    fail("discardReason missed");
  }
  if (discardedTaskArg !== undefined) {
    expect(discardedTaskArg).toBe("B");
  } else {
    fail("discardedTaskArg missed");
  }
});

test("taskExecutor: tryRun true", async () => {
  const taskExecutor = new PromiseMutex<string>();

  const { available, run } = taskExecutor.tryRun((arg) => task(arg, 100), "A");
  if (available) {
    run();
  }

  expect(available).toBe(true);
  expect(taskExecutor.runningTasks()).toBe(1);
});

test("taskExecutor: tryRun false (conncurrentLimitReached)", async () => {
  const taskExecutor = new PromiseMutex<string>();

  const { available, run } = taskExecutor.tryRun((arg) => task(arg, 20), "A");
  if (available) {
    run();
  }
  const { available: availableB, run: runB } = taskExecutor.tryRun((arg) => task(arg, 100), "B");

  expect(availableB).toBe(false);
  expect(runB).toBe(undefined);
});

test("taskExecutor: tryRun false (someOneIsWaitingTheLock)", async () => {
  const taskExecutor = new PromiseMutex<string>();

  const { available, run } = taskExecutor.tryRun((arg) => task(arg, 20), "A");
  if (available) {
    run();
  }
  taskExecutor.run((arg) => task(arg, 100), "B");
  const { available: availableC, run: runC } = taskExecutor.tryRun((arg) => task(arg, 100), "C");

  expect(availableC).toBe(false);
  expect(runC).toBe(undefined);
});

test("taskExecutor: releaseTimeoutHandler triggered", async () => {
  let timeoutHandlerTriggered = false;
  let taskArg: string | undefined;
  const timeoutHandler = (taskEntry: TaskEntry) => {
    timeoutHandlerTriggered = true;
    taskArg = taskEntry.arg;
  };

  const taskExecutor = new PromiseMutex({ releaseTimeout: 50, releaseTimeoutHandler: timeoutHandler });
  taskExecutor.run((arg) => task(arg, 100), "A");

  await setTimeout(70, undefined);

  expect(timeoutHandlerTriggered).toBe(true);
  if (taskArg !== undefined) {
    expect(taskArg).toBe("A");
  } else {
    fail("taskArg missed");
  }
});

test("taskExecutor: releaseTimeoutHandler not triggered", async () => {
  let timeoutHandlerTriggered = false;
  const timeoutHandler = () => {
    timeoutHandlerTriggered = true;
  };

  const taskExecutor = new PromiseMutex({ releaseTimeout: 100, releaseTimeoutHandler: timeoutHandler });
  taskExecutor.run((arg) => task(arg, 200), "A");

  await setTimeout(70, undefined);

  expect(timeoutHandlerTriggered).toBe(false);
});

test("taskExecutor: listen 'error' event (release-timeout-handler-failure)", async () => {
  const timeoutHandler = () => {
    throw Error("unexpected error on timeoutHandler");
  };

  const taskExecutor = new PromiseMutex({ releaseTimeout: 50, releaseTimeoutHandler: timeoutHandler });
  let errorEventTriggered = false;
  let taskEventError: TaskEventError | undefined;
  let taskArg: string | undefined;
  taskExecutor.on("error", (taskEntry: TaskEntry, error: TaskEventError) => {
    errorEventTriggered = true;
    taskEventError = error;
    taskArg = taskEntry.arg;
  });

  taskExecutor.run((arg) => task(arg, 200), "A");
  await setTimeout(100, undefined);

  expect(errorEventTriggered).toBe(true);
  if (taskEventError !== undefined) {
    expect(taskEventError.code).toBe("release-timeout-handler-failure");
  } else {
    fail("taskEventError missed");
  }
  if (taskArg !== undefined) {
    expect(taskArg).toBe("A");
  } else {
    fail("taskArg missed");
  }
});

test("taskExecutor: waitingTimeoutHandler triggered", async () => {
  let timeoutHandlerTriggered = false;
  let taskArg: string | undefined;
  const timeoutHandler = (taskEntry: TaskEntry) => {
    timeoutHandlerTriggered = true;
    taskArg = taskEntry.arg;
  };

  const taskExecutor = new PromiseMutex({ waitingTimeout: 50, waitingTimeoutHandler: timeoutHandler });
  taskExecutor.run((arg) => task(arg, 60), "A");
  taskExecutor.run((arg) => task(arg, 100), "B");

  await setTimeout(55, undefined);

  expect(timeoutHandlerTriggered).toBe(true);
  if (taskArg !== undefined) {
    expect(taskArg).toBe("B");
  } else {
    fail("taskArg missed");
  }
});

test("taskExecutor: waitingTimeoutHandler not triggered", async () => {
  let timeoutHandlerTriggered = false;

  const timeoutHandler = () => {
    timeoutHandlerTriggered = true;
  };

  const taskExecutor = new PromiseMutex({ waitingTimeout: 100, waitingTimeoutHandler: timeoutHandler });
  taskExecutor.run((arg) => task(arg, 50), "A");
  taskExecutor.run((arg) => task(arg, 50), "B");

  await setTimeout(70, undefined);

  expect(timeoutHandlerTriggered).toBe(false);
});

test("taskExecutor: waitingTimeoutHandler not triggered (flushPendingTasks)", async () => {
  let timeoutHandlerTriggered = false;

  const timeoutHandler = () => {
    timeoutHandlerTriggered = true;
  };

  const taskExecutor = new PromiseMutex({ waitingTimeout: 100, waitingTimeoutHandler: timeoutHandler });
  taskExecutor.run((arg) => task(arg, 50), "A");
  taskExecutor.run((arg) => task(arg, 50), "B");

  taskExecutor.flushPendingTasks();

  await setTimeout(70, undefined);

  expect(timeoutHandlerTriggered).toBe(false);
});

test("taskExecutor: listen 'error' event (waiting-timeout-handler-failure)", async () => {
  const timeoutHandler = () => {
    throw Error("unexpected error on timeoutHandler");
  };

  const taskExecutor = new PromiseMutex({ waitingTimeout: 50, waitingTimeoutHandler: timeoutHandler });
  let errorEventTriggered = false;
  let taskEventError: TaskEventError | undefined;
  let taskArg: string | undefined;
  taskExecutor.on("error", (taskEntry: TaskEntry, error: TaskEventError) => {
    errorEventTriggered = true;
    taskEventError = error;
    taskArg = taskEntry.arg;
  });

  taskExecutor.run((arg) => task(arg, 60), "A");
  taskExecutor.run((arg) => task(arg, 100), "B");
  await setTimeout(55, undefined);

  expect(errorEventTriggered).toBe(true);
  if (taskEventError !== undefined) {
    expect(taskEventError.code).toBe("waiting-timeout-handler-failure");
  } else {
    fail("taskEventError missed");
  }
  if (taskArg !== undefined) {
    expect(taskArg).toBe("B");
  } else {
    fail("taskArg missed");
  }
});

test("taskExecutor: listen 'error' event (error-handler-failure)", async () => {
  const errorHandler = (taskEntry: TaskEntry, error: any) => {
    throw Error("unexpected error on timeoutHandler");
  };

  const taskExecutor = new PromiseMutex({ errorHandler });
  let errorEventTriggered = false;
  let taskEventError: TaskEventError | undefined;
  let taskArg: string | undefined;
  taskExecutor.on("error", (taskEntry: TaskEntry, error: TaskEventError) => {
    errorEventTriggered = true;
    taskEventError = error;
    taskArg = taskEntry.arg;
  });

  taskExecutor.run(() => {
    throw new Error("task_failed");
  }, "A");

  await setTimeout(10, undefined);

  expect(errorEventTriggered).toBe(true);
  if (taskEventError !== undefined) {
    expect(taskEventError.code).toBe("error-handler-failure");
  } else {
    fail("taskEventError missed");
  }
  if (taskArg !== undefined) {
    expect(taskArg).toBe("A");
  } else {
    fail("taskArg missed");
  }
});

test("taskExecutor: releaseRunningTasks (runningTasks > 0)", async () => {
  const taskExecutor = new PromiseMutex<string>();

  taskExecutor.run(() => task("A", 100));

  const runningTaskBeforeRelease = taskExecutor.runningTasks();
  taskExecutor.releaseRunningTasks();
  const runningTaskAfterRelease = taskExecutor.runningTasks();

  expect(runningTaskBeforeRelease).toBe(1);
  expect(runningTaskAfterRelease).toBe(0);
});

test("taskExecutor: releaseRunningTasks (runningTasks = 0)", async () => {
  const taskExecutor = new PromiseMutex<string>();

  const runningTaskBeforeRelease = taskExecutor.runningTasks();
  taskExecutor.releaseRunningTasks();
  const runningTaskAfterRelease = taskExecutor.runningTasks();

  expect(runningTaskBeforeRelease).toBe(0);
  expect(runningTaskAfterRelease).toBe(0);
});

test("taskExecutor: waitingTasks", async () => {
  const taskExecutor = new PromiseMutex<string>();

  taskExecutor.run(() => task("A", 100));
  taskExecutor.run(() => task("B", 100));

  const waitingTaskBeforeRelease = taskExecutor.waitingTasks();
  taskExecutor.releaseRunningTasks();
  const waitingTaskAfterRelease = taskExecutor.waitingTasks();

  expect(waitingTaskBeforeRelease).toBe(1);
  expect(waitingTaskAfterRelease).toBe(0);
});

test("taskExecutor: flushPendingTasks (waitingTasks > 0)", async () => {
  const taskExecutor = new PromiseMutex<string>();

  taskExecutor.run(() => task("A", 100));
  taskExecutor.run(() => task("B", 100));

  const waitingTaskBeforeRelease = taskExecutor.waitingTasks();
  taskExecutor.flushPendingTasks();
  const waitingTaskAfterRelease = taskExecutor.waitingTasks();

  expect(waitingTaskBeforeRelease).toBe(1);
  expect(waitingTaskAfterRelease).toBe(0);
});

test("taskExecutor: flushPendingTasks (waitingTasks = 0)", async () => {
  const taskExecutor = new PromiseMutex<string>();

  const waitingTaskBeforeRelease = taskExecutor.waitingTasks();
  taskExecutor.flushPendingTasks();
  const waitingTaskAfterRelease = taskExecutor.waitingTasks();

  expect(waitingTaskBeforeRelease).toBe(0);
  expect(waitingTaskAfterRelease).toBe(0);
});

test("taskExecutor: expiredTasks", async () => {
  const taskExecutor = new PromiseMutex<string>();

  taskExecutor.run(() => task("A", 100));

  const expiredTaskBeforeRelease = taskExecutor.expiredTasks();
  taskExecutor.releaseRunningTasks();
  const expiredTaskAfterRelease = taskExecutor.expiredTasks();

  expect(expiredTaskBeforeRelease).toBe(0);
  expect(expiredTaskAfterRelease).toBe(1);
});

test("taskExecutor: changeConcurrentLimit (PromiseMutex)", async () => {
  const taskExecutor = new PromiseMutex<string>();

  taskExecutor.run(() => task("A", 100));

  const runningLimitReachedBeforeChangeConcurrentLimit = taskExecutor.isRunningLimitReached();
  taskExecutor.changeConcurrentLimit(2);
  const runningLimitReachedAfterChangeConcurrentLimit = taskExecutor.isRunningLimitReached();

  expect(runningLimitReachedBeforeChangeConcurrentLimit).toBe(true);
  expect(runningLimitReachedAfterChangeConcurrentLimit).toBe(true);
});

test("taskExecutor: TaskOptions (waitingTimeout)", async () => {
  const taskExecutor = new PromiseMutex<string>();

  let taskDiscardedEventTriggered = false;
  let discardReason: DiscardReason | undefined;
  let discardedTaskArg: string | undefined;
  taskExecutor.on("task-discarded", (taskEntry) => {
    taskDiscardedEventTriggered = true;
    discardReason = taskEntry.discardReason;
    discardedTaskArg = taskEntry.arg;
  });

  taskExecutor.run((arg) => task(arg, 100), "A");
  taskExecutor.run((arg) => task(arg, 100), "B", { waitingTimeout: 30 });

  await setTimeout(50, undefined);

  expect(taskDiscardedEventTriggered).toBe(true);
  if (discardReason !== undefined) {
    expect(discardReason).toBe("timeoutReached");
  } else {
    fail("discardReason missed");
  }
  if (discardedTaskArg !== undefined) {
    expect(discardedTaskArg).toBe("B");
  } else {
    fail("discardedTaskArg missed");
  }
});

test("taskExecutor: TaskOptions (waitingTimeout, waitingTimeoutHandler)", async () => {
  const taskExecutor = new PromiseMutex<string>();

  let timeoutHandlerTriggered = false;
  let taskArg: string | undefined;
  const timeoutHandler = (taskEntry: TaskEntry) => {
    timeoutHandlerTriggered = true;
    taskArg = taskEntry.arg;
  };

  taskExecutor.run((arg) => task(arg, 100), "A");
  taskExecutor.run((arg) => task(arg, 100), "B", { waitingTimeout: 30, waitingTimeoutHandler: timeoutHandler });

  await setTimeout(55, undefined);

  expect(timeoutHandlerTriggered).toBe(true);
  if (taskArg !== undefined) {
    expect(taskArg).toBe("B");
  } else {
    fail("taskArg missed");
  }
});

test("taskExecutor: TaskOptions (errorHandler)", async () => {
  const taskExecutor = new PromiseMutex<string>();

  let errorEventTriggered = false;
  let taskArg: string | undefined;
  let errorMessage: string | undefined;

  const errorHandler = (taskEntry: TaskEntry, error: any) => {
    errorEventTriggered = true;
    taskArg = taskEntry.arg;
    errorMessage = error.message;
  };

  taskExecutor.run(
    () => {
      throw new Error("task_failed");
    },
    "A",
    { errorHandler }
  );

  await setTimeout(10, undefined);

  expect(errorEventTriggered).toBe(true);
  if (errorMessage !== undefined) {
    expect(errorMessage).toBe("task_failed");
  } else {
    fail("errorMessage missed");
  }
  if (taskArg !== undefined) {
    expect(taskArg).toBe("A");
  } else {
    fail("taskArg missed");
  }
});

test("taskExecutor: TaskOptions (releaseTimeout, releaseTimeoutHandler)", async () => {
  let timeoutHandlerTriggered = false;
  let taskArg: string | undefined;
  const timeoutHandler = (taskEntry: TaskEntry) => {
    timeoutHandlerTriggered = true;
    taskArg = taskEntry.arg;
  };

  const taskExecutor = new PromiseMutex();
  taskExecutor.run((arg) => task(arg, 100), "A", { releaseTimeout: 50, releaseTimeoutHandler: timeoutHandler });

  await setTimeout(70, undefined);

  expect(timeoutHandlerTriggered).toBe(true);
  if (taskArg !== undefined) {
    expect(taskArg).toBe("A");
  } else {
    fail("taskArg missed");
  }
});

test("taskExecutor: TaskOptions (signal)", async () => {
  const abortController = new AbortController();

  const taskExecutor = new PromiseMutex<string>();
  let taskDiscardedEventTriggered = false;
  let discardReason: DiscardReason | undefined;
  let discardedTaskArg: string | undefined;
  taskExecutor.on("task-discarded", (taskEntry) => {
    taskDiscardedEventTriggered = true;
    discardReason = taskEntry.discardReason;
    discardedTaskArg = taskEntry.arg;
  });

  taskExecutor.run((arg) => task(arg, 20), "A");
  taskExecutor.run((arg) => task(arg, 100), "B", { signal: abortController.signal });

  await setTimeout(15, undefined);
  abortController.abort();
  await setTimeout(15, undefined);

  expect(taskDiscardedEventTriggered).toBe(true);
  if (discardReason !== undefined) {
    expect(discardReason).toBe("abortSignal");
  } else {
    fail("discardReason missed");
  }
  if (discardedTaskArg !== undefined) {
    expect(discardedTaskArg).toBe("B");
  } else {
    fail("discardedTaskArg missed");
  }
});