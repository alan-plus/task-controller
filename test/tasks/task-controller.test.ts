import { setTimeout } from "timers/promises";
import { TaskController } from "../../src/tasks/task-controller";
import { DiscardReason, ReleaseBeforeFinishReason, TaskEntry, TaskEventError } from "../../src/tasks/task-controller.type";

function task(result: string, timeout: number, resultsInOrder?: string[]): Promise<string> {
  return new Promise<string>(async (resolve) => {
    await setTimeout(timeout, undefined);

    if (resultsInOrder) {
      resultsInOrder.push(result);
    }

    resolve(result);
  });
}

function taskEntity(entity: { result: string; timeout: number; resultsInOrder?: string[] }): Promise<string> {
  return task(entity.result, entity.timeout, entity.resultsInOrder);
}

test("taskController: prevent concurrent task execution (default options)", async () => {
  const taskExecutor = new TaskController<string>();
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([
    { task, args: ["A", 120, resultsInOrder] },
    { task, args: ["B", 60, resultsInOrder] },
    { task, args: ["C", 10, resultsInOrder] },
  ]);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("taskController: runMany without args", async () => {
  const taskExecutor = new TaskController<string>();

  let taskRan = false;

  await taskExecutor.runMany([
    {
      task: async () => {
        taskRan = true;
      },
    },
  ]);

  await setTimeout(10, undefined);

  expect(taskRan).toBe(true);
});

test("taskController: runForEachArgs", async () => {
  const taskExecutor = new TaskController<string>();
  const resultsInOrder = new Array<string>();

  const argsArray = [
    ["A", 120, resultsInOrder],
    ["B", 60, resultsInOrder],
    ["C", 10, resultsInOrder],
  ];

  const response = await taskExecutor.runForEachArgs(argsArray, task);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");

  if (response[0]?.status === "fulfilled") {
    expect(response[0].value).toBe("A");
  } else {
    fail("response[0] rejected");
  }

  if (response[1]?.status === "fulfilled") {
    expect(response[1].value).toBe("B");
  } else {
    fail("response[1] rejected");
  }

  if (response[2]?.status === "fulfilled") {
    expect(response[2].value).toBe("C");
  } else {
    fail("response[2] rejected");
  }
});

test("taskController: runForEachEntity", async () => {
  const taskExecutor = new TaskController<string>();
  const resultsInOrder = new Array<string>();

  const entities = [
    { result: "A", timeout: 120, resultsInOrder: resultsInOrder },
    { result: "B", timeout: 60, resultsInOrder: resultsInOrder },
    { result: "C", timeout: 10, resultsInOrder: resultsInOrder },
  ];

  const response = await taskExecutor.runForEachEntity(entities, taskEntity);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");

  if (response[0]?.status === "fulfilled") {
    expect(response[0].value).toBe("A");
  } else {
    fail("response[0] rejected");
  }

  if (response[1]?.status === "fulfilled") {
    expect(response[1].value).toBe("B");
  } else {
    fail("response[1] rejected");
  }

  if (response[2]?.status === "fulfilled") {
    expect(response[2].value).toBe("C");
  } else {
    fail("response[2] rejected");
  }
});

test("taskController: prevent concurrent task execution FIFO", async () => {
  const taskExecutor = new TaskController<string>({ queueType: "FIFO" });
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([
    { task, args: ["A", 120, resultsInOrder] },
    { task, args: ["B", 60, resultsInOrder] },
    { task, args: ["C", 10, resultsInOrder] },
  ]);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("taskController: prevent concurrent task execution LIFO", async () => {
  const taskExecutor = new TaskController<string>({ queueType: "LIFO" });
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([
    { task, args: ["A", 120, resultsInOrder] },
    { task, args: ["B", 60, resultsInOrder] },
    { task, args: ["C", 10, resultsInOrder] },
  ]);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("C");
  expect(resultsInOrder[2]).toBe("B");
});

test("taskController: method run", async () => {
  const taskExecutor = new TaskController<string>();
  const resultsInOrder = new Array<string>();

  taskExecutor.run(task, "A", 120, resultsInOrder);
  taskExecutor.run(task, "B", 60, resultsInOrder);
  taskExecutor.run(task, "C", 10, resultsInOrder);

  await setTimeout(250, undefined);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("taskController: listen 'task-started' even", async () => {
  const taskExecutor = new TaskController<string>();
  let taskStartedEventTriggered = false;
  taskExecutor.on("task-started", () => {
    taskStartedEventTriggered = true;
  });

  taskExecutor.run(task, "A", 120);

  expect(taskStartedEventTriggered).toBe(true);
});

test("taskController: event listener off", async () => {
  const taskExecutor = new TaskController<string>();
  let taskStartedEventTriggered = false;
  const lockAcquiredListener = () => {
    taskStartedEventTriggered = true;
  };
  taskExecutor.on("task-started", lockAcquiredListener);
  taskExecutor.off("task-started", lockAcquiredListener);

  taskExecutor.run(task, "A", 120);

  expect(taskStartedEventTriggered).toBe(false);
});

test("taskController: listen 'task-finished' even", async () => {
  const taskExecutor = new TaskController<string>();
  let taskFinishedEventTriggered = false;
  taskExecutor.on("task-finished", () => {
    taskFinishedEventTriggered = true;
  });

  taskExecutor.run(task, "A", 10);
  await setTimeout(30, undefined);

  expect(taskFinishedEventTriggered).toBe(true);
});

test("taskController: listen 'task-failure' even", async () => {
  const taskExecutor = new TaskController<string>();
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

test("taskController: listen 'task-released-before-finished' even (release-timeout)", async () => {
  const taskExecutor = new TaskController<string>({ releaseTimeout: 10 });
  let taskReleasedBeforeFinishedEventTriggered = false;
  let releaseReason: ReleaseBeforeFinishReason | undefined;
  taskExecutor.on("task-released-before-finished", (taskEntry) => {
    taskReleasedBeforeFinishedEventTriggered = true;
    releaseReason = taskEntry.releaseReason;
  });

  taskExecutor.run(task, "A", 100);
  await setTimeout(20, undefined);

  expect(taskReleasedBeforeFinishedEventTriggered).toBe(true);
  if (releaseReason !== undefined) {
    expect(releaseReason).toBe("timeoutReached");
  } else {
    fail("releaseReason missed");
  }
});

test("taskController: listen 'task-released-before-finished' even (forced)", async () => {
  const taskExecutor = new TaskController<string>();
  let taskReleasedBeforeFinishedEventTriggered = false;
  let releaseReason: ReleaseBeforeFinishReason | undefined;
  taskExecutor.on("task-released-before-finished", (taskEntry) => {
    taskReleasedBeforeFinishedEventTriggered = true;
    releaseReason = taskEntry.releaseReason;
  });

  taskExecutor.run(task, "A", 100);
  taskExecutor.releaseRunningTasks();

  expect(taskReleasedBeforeFinishedEventTriggered).toBe(true);
  if (releaseReason !== undefined) {
    expect(releaseReason).toBe("forced");
  } else {
    fail("releaseReason missed");
  }
});

test("taskController: listen 'task-discarded' even (timeoutReached)", async () => {
  const taskExecutor = new TaskController<string>({ waitingTimeout: 30 });
  let taskDiscardedEventTriggered = false;
  let discardReason: DiscardReason | undefined;
  let discardedTaskArg: string[] | undefined;
  taskExecutor.on("task-discarded", (taskEntry) => {
    taskDiscardedEventTriggered = true;
    discardReason = taskEntry.discardReason;
    discardedTaskArg = taskEntry.args;
  });

  taskExecutor.run(task, "A", 100);
  taskExecutor.run(task, "B", 100);

  await setTimeout(50, undefined);

  expect(taskDiscardedEventTriggered).toBe(true);
  if (discardReason !== undefined) {
    expect(discardReason).toBe("timeoutReached");
  } else {
    fail("discardReason missed");
  }
  if (discardedTaskArg !== undefined) {
    expect(discardedTaskArg[0]).toBe("B");
  } else {
    fail("discardedTaskArg missed");
  }
});

test("taskController: listen 'task-discarded' even (forced)", async () => {
  const taskExecutor = new TaskController<string>();
  let taskDiscardedEventTriggered = false;
  let discardReason: DiscardReason | undefined;
  let discardedTaskArgs: string[] | undefined;
  taskExecutor.on("task-discarded", (taskEntry) => {
    taskDiscardedEventTriggered = true;
    discardReason = taskEntry.discardReason;
    discardedTaskArgs = taskEntry.args;
  });

  taskExecutor.run(task, "A", 100);
  taskExecutor.run(task, "B", 100);

  await setTimeout(10, undefined);

  taskExecutor.flushPendingTasks();

  expect(taskDiscardedEventTriggered).toBe(true);
  if (discardReason !== undefined) {
    expect(discardReason).toBe("forced");
  } else {
    fail("discardReason missed");
  }
  if (discardedTaskArgs !== undefined) {
    expect(discardedTaskArgs[0]).toBe("B");
  } else {
    fail("discardedTaskArg missed");
  }
});

test("taskController: listen 'task-discarded' even (abortSignal)", async () => {
  const abortController = new AbortController();

  const taskExecutor = new TaskController<string>({ signal: abortController.signal });
  let taskDiscardedEventTriggered = false;
  let discardReason: DiscardReason | undefined;
  let discardedTaskArgs: string[] | undefined;
  taskExecutor.on("task-discarded", (taskEntry) => {
    taskDiscardedEventTriggered = true;
    discardReason = taskEntry.discardReason;
    discardedTaskArgs = taskEntry.args;
  });

  taskExecutor.run(task, "A", 20);
  taskExecutor.run(task, "B", 100);

  await setTimeout(15, undefined);
  abortController.abort();
  await setTimeout(15, undefined);

  expect(taskDiscardedEventTriggered).toBe(true);
  if (discardReason !== undefined) {
    expect(discardReason).toBe("abortSignal");
  } else {
    fail("discardReason missed");
  }
  if (discardedTaskArgs !== undefined) {
    expect(discardedTaskArgs[0]).toBe("B");
  } else {
    fail("discardedTaskArg missed");
  }
});

test("taskController: tryRun true", async () => {
  const taskExecutor = new TaskController<string>();

  const { available, run } = taskExecutor.tryRun(task, "A", 100);
  if (available) {
    run();
  }

  expect(available).toBe(true);
  expect(taskExecutor.runningTasks()).toBe(1);
});

test("taskController: tryRun false (conncurrentLimitReached)", async () => {
  const taskExecutor = new TaskController<string>();

  const { available, run } = taskExecutor.tryRun(task, "A", 20);
  if (available) {
    run();
  }
  const { available: availableB, run: runB } = taskExecutor.tryRun(task, "B", 100);

  expect(availableB).toBe(false);
  expect(runB).toBe(undefined);
});

test("taskController: tryRun false (someOneIsWaitingTheLock)", async () => {
  const taskExecutor = new TaskController<string>();

  const { available, run } = taskExecutor.tryRun(task, "A", 20);
  if (available) {
    run();
  }
  taskExecutor.run(task, "B", 100);
  const { available: availableC, run: runC } = taskExecutor.tryRun(task, "C", 100);

  expect(availableC).toBe(false);
  expect(runC).toBe(undefined);
});

test("taskController: releaseTimeoutHandler triggered", async () => {
  let timeoutHandlerTriggered = false;
  let taskArgs: string[] | undefined;
  const timeoutHandler = (taskEntry: TaskEntry) => {
    timeoutHandlerTriggered = true;
    taskArgs = taskEntry.args;
  };

  const taskExecutor = new TaskController({ releaseTimeout: 50, releaseTimeoutHandler: timeoutHandler });
  taskExecutor.run(task, "A", 100);

  await setTimeout(70, undefined);

  expect(timeoutHandlerTriggered).toBe(true);
  if (taskArgs !== undefined) {
    expect(taskArgs[0]).toBe("A");
  } else {
    fail("taskArg missed");
  }
});

test("taskController: releaseTimeoutHandler not triggered", async () => {
  let timeoutHandlerTriggered = false;
  const timeoutHandler = () => {
    timeoutHandlerTriggered = true;
  };

  const taskExecutor = new TaskController({ releaseTimeout: 100, releaseTimeoutHandler: timeoutHandler });
  taskExecutor.run(task, "A", 200);

  await setTimeout(70, undefined);

  expect(timeoutHandlerTriggered).toBe(false);
});

test("taskController: listen 'error' event (release-timeout-handler-failure)", async () => {
  const timeoutHandler = () => {
    throw Error("unexpected error on timeoutHandler");
  };

  const taskExecutor = new TaskController({ releaseTimeout: 50, releaseTimeoutHandler: timeoutHandler });
  let errorEventTriggered = false;
  let taskEventError: TaskEventError | undefined;
  let taskArgs: string[] | undefined;
  taskExecutor.on("error", (taskEntry: TaskEntry, error: TaskEventError) => {
    errorEventTriggered = true;
    taskEventError = error;
    taskArgs = taskEntry.args;
  });

  taskExecutor.run(task, "A", 200);
  await setTimeout(100, undefined);

  expect(errorEventTriggered).toBe(true);
  if (taskEventError !== undefined) {
    expect(taskEventError.code).toBe("release-timeout-handler-failure");
  } else {
    fail("taskEventError missed");
  }
  if (taskArgs !== undefined) {
    expect(taskArgs[0]).toBe("A");
  } else {
    fail("taskArg missed");
  }
});

test("taskController: waitingTimeoutHandler triggered", async () => {
  let timeoutHandlerTriggered = false;
  let taskArgs: string[] | undefined;
  const timeoutHandler = (taskEntry: TaskEntry) => {
    timeoutHandlerTriggered = true;
    taskArgs = taskEntry.args;
  };

  const taskExecutor = new TaskController({ waitingTimeout: 50, waitingTimeoutHandler: timeoutHandler });
  taskExecutor.run(task, "A", 60);
  taskExecutor.run(task, "B", 100);

  await setTimeout(55, undefined);

  expect(timeoutHandlerTriggered).toBe(true);
  if (taskArgs !== undefined) {
    expect(taskArgs[0]).toBe("B");
  } else {
    fail("taskArg missed");
  }
});

test("taskController: waitingTimeoutHandler not triggered", async () => {
  let timeoutHandlerTriggered = false;

  const timeoutHandler = () => {
    timeoutHandlerTriggered = true;
  };

  const taskExecutor = new TaskController({ waitingTimeout: 100, waitingTimeoutHandler: timeoutHandler });
  taskExecutor.run(task, "A", 50);
  taskExecutor.run(task, "B", 50);

  await setTimeout(70, undefined);

  expect(timeoutHandlerTriggered).toBe(false);
});

test("taskController: waitingTimeoutHandler not triggered (flushPendingTasks)", async () => {
  let timeoutHandlerTriggered = false;

  const timeoutHandler = () => {
    timeoutHandlerTriggered = true;
  };

  const taskExecutor = new TaskController({ waitingTimeout: 100, waitingTimeoutHandler: timeoutHandler });
  taskExecutor.run(task, "A", 50);
  taskExecutor.run(task, "B", 50);

  taskExecutor.flushPendingTasks();

  await setTimeout(70, undefined);

  expect(timeoutHandlerTriggered).toBe(false);
});

test("taskController: listen 'error' event (waiting-timeout-handler-failure)", async () => {
  const timeoutHandler = () => {
    throw Error("unexpected error on timeoutHandler");
  };

  const taskExecutor = new TaskController({ waitingTimeout: 50, waitingTimeoutHandler: timeoutHandler });
  let errorEventTriggered = false;
  let taskEventError: TaskEventError | undefined;
  let taskArgs: string[] | undefined;
  taskExecutor.on("error", (taskEntry: TaskEntry, error: TaskEventError) => {
    errorEventTriggered = true;
    taskEventError = error;
    taskArgs = taskEntry.args;
  });

  taskExecutor.run(task, "A", 60);
  taskExecutor.run(task, "B", 100);
  await setTimeout(55, undefined);

  expect(errorEventTriggered).toBe(true);
  if (taskEventError !== undefined) {
    expect(taskEventError.code).toBe("waiting-timeout-handler-failure");
  } else {
    fail("taskEventError missed");
  }
  if (taskArgs !== undefined) {
    expect(taskArgs[0]).toBe("B");
  } else {
    fail("taskArg missed");
  }
});

test("taskController: listen 'error' event (error-handler-failure)", async () => {
  const errorHandler = (taskEntry: TaskEntry, error: any) => {
    throw Error("unexpected error on timeoutHandler");
  };

  const taskExecutor = new TaskController({ errorHandler });
  let errorEventTriggered = false;
  let taskEventError: TaskEventError | undefined;
  let taskArgs: string[] | undefined;
  taskExecutor.on("error", (taskEntry: TaskEntry, error: TaskEventError) => {
    errorEventTriggered = true;
    taskEventError = error;
    taskArgs = taskEntry.args;
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
  if (taskArgs !== undefined) {
    expect(taskArgs[0]).toBe("A");
  } else {
    fail("taskArg missed");
  }
});

test("taskController: releaseRunningTasks (runningTasks > 0)", async () => {
  const taskExecutor = new TaskController<string>();

  taskExecutor.run(task, "A", 100);

  const runningTaskBeforeRelease = taskExecutor.runningTasks();
  taskExecutor.releaseRunningTasks();
  const runningTaskAfterRelease = taskExecutor.runningTasks();

  expect(runningTaskBeforeRelease).toBe(1);
  expect(runningTaskAfterRelease).toBe(0);
});

test("taskController: releaseRunningTasks (runningTasks = 0)", async () => {
  const taskExecutor = new TaskController<string>();

  const runningTaskBeforeRelease = taskExecutor.runningTasks();
  taskExecutor.releaseRunningTasks();
  const runningTaskAfterRelease = taskExecutor.runningTasks();

  expect(runningTaskBeforeRelease).toBe(0);
  expect(runningTaskAfterRelease).toBe(0);
});

test("taskController: waitingTasks", async () => {
  const taskExecutor = new TaskController<string>();

  taskExecutor.run(task, "A", 100);
  taskExecutor.run(task, "B", 100);

  const waitingTaskBeforeRelease = taskExecutor.waitingTasks();
  taskExecutor.releaseRunningTasks();
  const waitingTaskAfterRelease = taskExecutor.waitingTasks();

  expect(waitingTaskBeforeRelease).toBe(1);
  expect(waitingTaskAfterRelease).toBe(0);
});

test("taskController: flushPendingTasks (waitingTasks > 0)", async () => {
  const taskExecutor = new TaskController<string>();

  taskExecutor.run(task, "A", 100);
  taskExecutor.run(task, "B", 100);

  const waitingTaskBeforeRelease = taskExecutor.waitingTasks();
  taskExecutor.flushPendingTasks();
  const waitingTaskAfterRelease = taskExecutor.waitingTasks();

  expect(waitingTaskBeforeRelease).toBe(1);
  expect(waitingTaskAfterRelease).toBe(0);
});

test("taskController: flushPendingTasks (waitingTasks = 0)", async () => {
  const taskExecutor = new TaskController<string>();

  const waitingTaskBeforeRelease = taskExecutor.waitingTasks();
  taskExecutor.flushPendingTasks();
  const waitingTaskAfterRelease = taskExecutor.waitingTasks();

  expect(waitingTaskBeforeRelease).toBe(0);
  expect(waitingTaskAfterRelease).toBe(0);
});

test("taskController: expiredTasks", async () => {
  const taskExecutor = new TaskController<string>();

  taskExecutor.run(task, "A", 100);

  const expiredTaskBeforeRelease = taskExecutor.expiredTasks();
  taskExecutor.releaseRunningTasks();
  const expiredTaskAfterRelease = taskExecutor.expiredTasks();

  expect(expiredTaskBeforeRelease).toBe(0);
  expect(expiredTaskAfterRelease).toBe(1);
});

test("taskController: TaskOptions (waitingTimeout)", async () => {
  const taskExecutor = new TaskController<string>();

  let taskDiscardedEventTriggered = false;
  let discardReason: DiscardReason | undefined;
  let discardedTaskArgs: string[] | undefined;
  taskExecutor.on("task-discarded", (taskEntry) => {
    taskDiscardedEventTriggered = true;
    discardReason = taskEntry.discardReason;
    discardedTaskArgs = taskEntry.args;
  });

  taskExecutor.run(task, "A", 100);
  taskExecutor.runWithOptions(task, { waitingTimeout: 30 }, "B", 100);

  await setTimeout(50, undefined);

  expect(taskDiscardedEventTriggered).toBe(true);
  if (discardReason !== undefined) {
    expect(discardReason).toBe("timeoutReached");
  } else {
    fail("discardReason missed");
  }
  if (discardedTaskArgs !== undefined) {
    expect(discardedTaskArgs[0]).toBe("B");
  } else {
    fail("discardedTaskArg missed");
  }
});

test("taskController: TaskOptions (waitingTimeout, waitingTimeoutHandler)", async () => {
  const taskExecutor = new TaskController<string>();

  let timeoutHandlerTriggered = false;
  let taskArgs: string[] | undefined;
  const timeoutHandler = (taskEntry: TaskEntry) => {
    timeoutHandlerTriggered = true;
    taskArgs = taskEntry.args;
  };

  taskExecutor.run(task, "A", 100);
  taskExecutor.runWithOptions(task, { waitingTimeout: 30, waitingTimeoutHandler: timeoutHandler }, "B", 100);

  await setTimeout(55, undefined);

  expect(timeoutHandlerTriggered).toBe(true);
  if (taskArgs !== undefined) {
    expect(taskArgs[0]).toBe("B");
  } else {
    fail("taskArg missed");
  }
});

test("taskController: TaskOptions (errorHandler)", async () => {
  const taskExecutor = new TaskController<string>();

  let errorEventTriggered = false;
  let taskArgs: string[] | undefined;
  let errorMessage: string | undefined;

  const errorHandler = (taskEntry: TaskEntry, error: any) => {
    errorEventTriggered = true;
    taskArgs = taskEntry.args;
    errorMessage = error.message;
  };

  taskExecutor.runWithOptions(
    () => {
      throw new Error("task_failed");
    },
    { errorHandler },
    "A"
  );

  await setTimeout(10, undefined);

  expect(errorEventTriggered).toBe(true);
  if (errorMessage !== undefined) {
    expect(errorMessage).toBe("task_failed");
  } else {
    fail("errorMessage missed");
  }
  if (taskArgs !== undefined) {
    expect(taskArgs[0]).toBe("A");
  } else {
    fail("taskArg missed");
  }
});

test("taskController: TaskOptions (releaseTimeout, releaseTimeoutHandler)", async () => {
  let timeoutHandlerTriggered = false;
  let taskArgs: string[] | undefined;
  const timeoutHandler = (taskEntry: TaskEntry) => {
    timeoutHandlerTriggered = true;
    taskArgs = taskEntry.args;
  };

  const taskExecutor = new TaskController();
  taskExecutor.runWithOptions(task, { releaseTimeout: 50, releaseTimeoutHandler: timeoutHandler }, "A", 100);

  await setTimeout(70, undefined);

  expect(timeoutHandlerTriggered).toBe(true);
  if (taskArgs !== undefined) {
    expect(taskArgs[0]).toBe("A");
  } else {
    fail("taskArg missed");
  }
});

test("taskController: TaskOptions (signal)", async () => {
  const abortController = new AbortController();

  const taskExecutor = new TaskController<string>();
  let taskDiscardedEventTriggered = false;
  let discardReason: DiscardReason | undefined;
  let discardedTaskArgs: string[] | undefined;
  taskExecutor.on("task-discarded", (taskEntry) => {
    taskDiscardedEventTriggered = true;
    discardReason = taskEntry.discardReason;
    discardedTaskArgs = taskEntry.args;
  });

  taskExecutor.run(task, "A", 20);
  taskExecutor.runWithOptions(task, { signal: abortController.signal }, "B", 100);

  await setTimeout(15, undefined);
  abortController.abort();
  await setTimeout(15, undefined);

  expect(taskDiscardedEventTriggered).toBe(true);
  if (discardReason !== undefined) {
    expect(discardReason).toBe("abortSignal");
  } else {
    fail("discardReason missed");
  }
  if (discardedTaskArgs !== undefined) {
    expect(discardedTaskArgs[0]).toBe("B");
  } else {
    fail("discardedTaskArg missed");
  }
});

test("taskController: allow limited concurrent task execution", async () => {
  const taskExecutor = new TaskController<string>({ concurrency: 2 });
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([
    { task, args: ["A", 120, resultsInOrder] },
    { task, args: ["B", 60, resultsInOrder] },
    { task, args: ["C", 10, resultsInOrder] },
  ]);

  expect(resultsInOrder[0]).toBe("B");
  expect(resultsInOrder[1]).toBe("C");
  expect(resultsInOrder[2]).toBe("A");
});

test("taskController: runMany arguments", async () => {
  const taskExecutor = new TaskController<string>({ concurrency: 2 });
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([
    { task, args: ["A", 120, resultsInOrder] },
    { task, args: ["B", 60, resultsInOrder] },
    { task, args: [undefined, 10, resultsInOrder] },
  ]);

  expect(resultsInOrder[0]).toBe("B");
  expect(resultsInOrder[1]).toBe(undefined);
  expect(resultsInOrder[2]).toBe("A");
});

test("taskController: default options", async () => {
  const taskExecutor = new TaskController<string>();
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([
    { task, args: ["A", 120, resultsInOrder] },
    { task, args: ["B", 60, resultsInOrder] },
    { task, args: ["C", 10, resultsInOrder] },
  ]);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("taskController: invalid options", async () => {
  const taskExecutor = new TaskController<string>({ concurrency: "5" } as any);
  const resultsInOrder = new Array<string>();

  await taskExecutor.runMany([
    { task, args: ["A", 120, resultsInOrder] },
    { task, args: ["B", 60, resultsInOrder] },
    { task, args: ["C", 10, resultsInOrder] },
  ]);

  expect(resultsInOrder[0]).toBe("A");
  expect(resultsInOrder[1]).toBe("B");
  expect(resultsInOrder[2]).toBe("C");
});

test("taskController: method run", async () => {
  const taskExecutor = new TaskController<string>({ concurrency: 2 });
  const resultsInOrder = new Array<string>();

  taskExecutor.run(task, "A", 120, resultsInOrder);
  taskExecutor.run(task, "B", 60, resultsInOrder);
  taskExecutor.run(task, "C", 10, resultsInOrder);

  await setTimeout(250, undefined);

  expect(resultsInOrder[0]).toBe("B");
  expect(resultsInOrder[1]).toBe("C");
  expect(resultsInOrder[2]).toBe("A");
});

test("taskController: changeConcurrentLimit", async () => {
  const taskExecutor = new TaskController<string>({ concurrency: 1 });
  taskExecutor.run(task, "A", 120);

  const runningLimitReachedBeforeChangeConcurrentLimit = !taskExecutor.isAvailable();
  taskExecutor.changeConcurrentLimit(2);
  const runningLimitReachedAfterChangeConcurrentLimit = !taskExecutor.isAvailable();

  expect(runningLimitReachedBeforeChangeConcurrentLimit).toBe(true);
  expect(runningLimitReachedAfterChangeConcurrentLimit).toBe(false);
});

test("taskController: concurrency (NaN)", async () => {
  const taskExecutor = new TaskController<string>({ concurrency: NaN });

  const runningLimitReachedBeforeRuntask = !taskExecutor.isAvailable();
  taskExecutor.run(task, "A", 120);
  const runningLimitReachedAfterRuntask = !taskExecutor.isAvailable();

  expect(runningLimitReachedBeforeRuntask).toBe(false);
  expect(runningLimitReachedAfterRuntask).toBe(true);
});

test("taskController: concurrency (Infinity)", async () => {
  const taskExecutor = new TaskController<string>({ concurrency: Infinity });

  const runningLimitReachedBeforeRuntask = !taskExecutor.isAvailable();
  taskExecutor.run(task, "A", 120);
  const runningLimitReachedAfterRuntask = !taskExecutor.isAvailable();

  expect(runningLimitReachedBeforeRuntask).toBe(false);
  expect(runningLimitReachedAfterRuntask).toBe(true);
});

test("taskController: concurrency (Infinity)", async () => {
  const taskExecutor = new TaskController<string>({ concurrency: 0.9 });

  const runningLimitReachedBeforeRuntask = !taskExecutor.isAvailable();
  taskExecutor.run(task, "A", 120);
  const runningLimitReachedAfterRuntask = !taskExecutor.isAvailable();

  expect(runningLimitReachedBeforeRuntask).toBe(false);
  expect(runningLimitReachedAfterRuntask).toBe(true);
});

test("taskController: changeConcurrentLimit (null)", async () => {
  const taskExecutor = new TaskController<string>();
  taskExecutor.changeConcurrentLimit(null as unknown as number);

  const runningLimitReachedBeforeRuntask = !taskExecutor.isAvailable();
  taskExecutor.run(task, "A", 120);
  const runningLimitReachedAfterRuntask = !taskExecutor.isAvailable();

  expect(runningLimitReachedBeforeRuntask).toBe(false);
  expect(runningLimitReachedAfterRuntask).toBe(true);
});

test("taskController: changeConcurrentLimit (NaN)", async () => {
  const taskExecutor = new TaskController<string>();
  taskExecutor.changeConcurrentLimit(NaN);

  const runningLimitReachedBeforeRuntask = !taskExecutor.isAvailable();
  taskExecutor.run(task, "A", 120);
  const runningLimitReachedAfterRuntask = !taskExecutor.isAvailable();

  expect(runningLimitReachedBeforeRuntask).toBe(false);
  expect(runningLimitReachedAfterRuntask).toBe(true);
});

test("taskController: changeConcurrentLimit (0)", async () => {
  const taskExecutor = new TaskController<string>();
  taskExecutor.changeConcurrentLimit(0);

  const runningLimitReachedBeforeRuntask = !taskExecutor.isAvailable();
  taskExecutor.run(task, "A", 120);
  const runningLimitReachedAfterRuntask = !taskExecutor.isAvailable();

  expect(runningLimitReachedBeforeRuntask).toBe(false);
  expect(runningLimitReachedAfterRuntask).toBe(true);
});
