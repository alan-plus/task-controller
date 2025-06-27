import { setTimeout } from "timers/promises";
import { LockController } from "../../src/locks/lock-controller";
import { MultiStepController } from "../../src/tasks/multi-step-controller";
import { FixedLengthArray } from "../../src/tasks/task-controller.types";

function task(
  stepLocks: FixedLengthArray<LockController, 3>,
  result: string,
  timeout: number,
  stepResultsArray?: string[][] | null
): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    const release1 = await stepLocks[0].acquire();
    try {
      await setTimeout(timeout, undefined);
      if (stepResultsArray) {
        stepResultsArray[0]?.push(result);
      }
    } finally {
      release1();
    }

    const release2 = await stepLocks[1].acquire();
    try {
      await setTimeout(timeout, undefined);
      if (stepResultsArray) {
        stepResultsArray[1]?.push(result);
      }
    } finally {
      release2();
    }

    const release3 = await stepLocks[2].acquire();
    try {
      await setTimeout(timeout, undefined);
      if (stepResultsArray) {
        stepResultsArray[2]?.push(result);
      }
    } finally {
      release3();
    }

    resolve(result);
  });
}

async function taskEntity(
  stepLocks: FixedLengthArray<LockController, 3>,
  entity: { result: string; timeout: number; stepResultsArray?: string[][] | null }
): Promise<string> {
  return task(stepLocks, entity.result, entity.timeout, entity.stepResultsArray);
}

test("multiStepController: documentation example (concurrency = 2)", async () => {
  const output = new Array<string>();

  const multiStepController = new MultiStepController<void, 2>({ stepConcurrencies: [1, 2] });

  const task = async (
    stepLocks: FixedLengthArray<LockController, 2>,
    entity: { taskId: number; step1Timeout: number; step2Timeout: number; console: string[] }
  ) => {
    const release1 = await stepLocks[0].acquire();
    try {
      entity.console.push(`Task ${entity.taskId} selected to execute step 1`);
      await setTimeout(entity.step1Timeout, "just to simulate some logic");
      entity.console.push(`Task ${entity.taskId} finished step 1`);
    } finally {
      release1();
    }

    const release2 = await stepLocks[1].acquire();
    try {
      entity.console.push(`Task ${entity.taskId} selected to execute step 2`);
      await setTimeout(entity.step2Timeout, "just to simulate some logic");
      entity.console.push(`Task ${entity.taskId} finished step 2`);
    } finally {
      release2();
    }
  };

  await multiStepController.runForEach(
    [
      { taskId: 1, step1Timeout: 40, step2Timeout: 120, console: output },
      { taskId: 2, step1Timeout: 30, step2Timeout: 50, console: output },
      { taskId: 3, step1Timeout: 30, step2Timeout: 50, console: output },
    ],
    task
  );

  expect(output[0]).toBe("Task 1 selected to execute step 1");
  expect(output[1]).toBe("Task 1 finished step 1");
  expect(output[2]).toBe("Task 2 selected to execute step 1");
  expect(output[3]).toBe("Task 1 selected to execute step 2");
  expect(output[4]).toBe("Task 2 finished step 1");
  expect(output[5]).toBe("Task 3 selected to execute step 1");
  expect(output[6]).toBe("Task 2 selected to execute step 2");
  expect(output[7]).toBe("Task 3 finished step 1");
  expect(output[8]).toBe("Task 2 finished step 2");
  expect(output[9]).toBe("Task 3 selected to execute step 2");
  expect(output[10]).toBe("Task 1 finished step 2");
  expect(output[11]).toBe("Task 3 finished step 2");
});

test("multiStepController: runMany with arguments", async () => {
  const taskExecutor = new MultiStepController<string, 3>({ stepConcurrencies: [1, 2, 2] });
  const stepResultsArray = new Array<string[]>();
  const resultsStep1 = new Array<string>();
  const resultsStep2 = new Array<string>();
  const resultsStep3 = new Array<string>();
  stepResultsArray.push(resultsStep1);
  stepResultsArray.push(resultsStep2);
  stepResultsArray.push(resultsStep3);

  await taskExecutor.runMany([
    { task, args: ["A", 140, stepResultsArray] },
    { task, args: ["B", 40, stepResultsArray] },
    { task, args: ["C", 5, stepResultsArray] },
  ]);

  expect(resultsStep1[0]).toBe("A");
  expect(resultsStep1[1]).toBe("B");
  expect(resultsStep1[2]).toBe("C");

  expect(resultsStep2[0]).toBe("B");
  expect(resultsStep2[1]).toBe("C");
  expect(resultsStep2[2]).toBe("A");

  expect(resultsStep3[0]).toBe("C");
  expect(resultsStep3[1]).toBe("B");
  expect(resultsStep3[2]).toBe("A");
});

test("multiStepController: runMany without arguments", async () => {
  const taskExecutor = new MultiStepController<void, 3>({ stepConcurrencies: [1, 1, 1] });
  const stepResultsArray = new Array<string[]>();
  const resultsStep1 = new Array<string>();
  const resultsStep2 = new Array<string>();
  const resultsStep3 = new Array<string>();
  stepResultsArray.push(resultsStep1);
  stepResultsArray.push(resultsStep2);
  stepResultsArray.push(resultsStep3);

  await taskExecutor.runMany([
    {
      task: async (stepLocks: FixedLengthArray<LockController, 3>) => {
        resultsStep1.push("A");
        resultsStep2.push("A");
        resultsStep3.push("A");
      },
    },
    {
      task: async (stepLocks: FixedLengthArray<LockController, 3>) => {
        resultsStep1.push("B");
        resultsStep2.push("B");
        resultsStep3.push("B");
      },
    },
    {
      task: async (stepLocks: FixedLengthArray<LockController, 3>) => {
        resultsStep1.push("C");
        resultsStep2.push("C");
        resultsStep3.push("C");
      },
    },
  ]);

  expect(resultsStep1[0]).toBe("A");
  expect(resultsStep1[1]).toBe("B");
  expect(resultsStep1[2]).toBe("C");

  expect(resultsStep2[0]).toBe("A");
  expect(resultsStep2[1]).toBe("B");
  expect(resultsStep2[2]).toBe("C");

  expect(resultsStep3[0]).toBe("A");
  expect(resultsStep3[1]).toBe("B");
  expect(resultsStep3[2]).toBe("C");
});

test("multiStepController: runForEachArgs", async () => {
  const taskExecutor = new MultiStepController<string, 3>({ stepConcurrencies: [1, 2, 2] });
  const stepResultsArray = new Array<string[]>();
  const resultsStep1 = new Array<string>();
  const resultsStep2 = new Array<string>();
  const resultsStep3 = new Array<string>();
  stepResultsArray.push(resultsStep1);
  stepResultsArray.push(resultsStep2);
  stepResultsArray.push(resultsStep3);

  await taskExecutor.runForEachArgs(
    [
      ["A", 140, stepResultsArray],
      ["B", 40, stepResultsArray],
      ["C", 5, stepResultsArray],
    ],
    task
  );

  expect(resultsStep1[0]).toBe("A");
  expect(resultsStep1[1]).toBe("B");
  expect(resultsStep1[2]).toBe("C");

  expect(resultsStep2[0]).toBe("B");
  expect(resultsStep2[1]).toBe("C");
  expect(resultsStep2[2]).toBe("A");

  expect(resultsStep3[0]).toBe("C");
  expect(resultsStep3[1]).toBe("B");
  expect(resultsStep3[2]).toBe("A");
});

test("multiStepController: runForEach", async () => {
  const taskExecutor = new MultiStepController<string, 3>({ stepConcurrencies: [1, 2, 2] });
  const stepResultsArray = new Array<string[]>();
  const resultsStep1 = new Array<string>();
  const resultsStep2 = new Array<string>();
  const resultsStep3 = new Array<string>();
  stepResultsArray.push(resultsStep1);
  stepResultsArray.push(resultsStep2);
  stepResultsArray.push(resultsStep3);

  const entities = [
    { result: "A", timeout: 140, stepResultsArray },
    { result: "B", timeout: 40, stepResultsArray },
    { result: "C", timeout: 5, stepResultsArray },
  ];

  await taskExecutor.runForEach(entities, taskEntity);

  expect(resultsStep1[0]).toBe("A");
  expect(resultsStep1[1]).toBe("B");
  expect(resultsStep1[2]).toBe("C");

  expect(resultsStep2[0]).toBe("B");
  expect(resultsStep2[1]).toBe("C");
  expect(resultsStep2[2]).toBe("A");

  expect(resultsStep3[0]).toBe("C");
  expect(resultsStep3[1]).toBe("B");
  expect(resultsStep3[2]).toBe("A");
});

test("multiStepController: method run", async () => {
  const taskExecutor = new MultiStepController<string, 3>({ stepConcurrencies: [1, 2, 2] });
  const stepResultsArray = new Array<string[]>();
  const resultsStep1 = new Array<string>();
  const resultsStep2 = new Array<string>();
  const resultsStep3 = new Array<string>();
  stepResultsArray.push(resultsStep1);
  stepResultsArray.push(resultsStep2);
  stepResultsArray.push(resultsStep3);

  taskExecutor.run(task, "A", 140, stepResultsArray);
  taskExecutor.run(task, "B", 40, stepResultsArray);
  taskExecutor.run(task, "C", 5, stepResultsArray);

  await setTimeout(600, undefined);

  expect(resultsStep1[0]).toBe("A");
  expect(resultsStep1[1]).toBe("B");
  expect(resultsStep1[2]).toBe("C");

  expect(resultsStep2[0]).toBe("B");
  expect(resultsStep2[1]).toBe("C");
  expect(resultsStep2[2]).toBe("A");

  expect(resultsStep3[0]).toBe("C");
  expect(resultsStep3[1]).toBe("B");
  expect(resultsStep3[2]).toBe("A");
});

test("multiStepController: releaseAll", async () => {
  const taskExecutor = new MultiStepController<string, 3>({ stepConcurrencies: [1, 1, 1] });

  taskExecutor.run(task, "A", 50, null);
  taskExecutor.run(task, "B", 50, null);
  taskExecutor.run(task, "C", 50, null);

  await setTimeout(145, undefined);

  const step1LockLimitReachedBeforeRelease = taskExecutor.isStepLockLimitReached(0);
  const step2LockLimitReachedBeforeRelease = taskExecutor.isStepLockLimitReached(1);
  const step3LockLimitReachedBeforeRelease = taskExecutor.isStepLockLimitReached(2);

  taskExecutor.releaseAll();

  const step1LockLimitReachedAfterRelease = taskExecutor.isStepLockLimitReached(0);
  const step2LockLimitReachedAfterRelease = taskExecutor.isStepLockLimitReached(1);
  const step3LockLimitReachedAfterRelease = taskExecutor.isStepLockLimitReached(2);

  expect(step1LockLimitReachedBeforeRelease).toBe(true);
  expect(step2LockLimitReachedBeforeRelease).toBe(true);
  expect(step3LockLimitReachedBeforeRelease).toBe(true);

  expect(step1LockLimitReachedAfterRelease).toBe(false);
  expect(step2LockLimitReachedAfterRelease).toBe(false);
  expect(step3LockLimitReachedAfterRelease).toBe(false);
});

test("multiStepController: isStepLockLimitReached (not exist step)", async () => {
  const taskExecutor = new MultiStepController<string, 3>({ stepConcurrencies: [1, 1, 1] });

  const notExistStepLockLimitReached = taskExecutor.isStepLockLimitReached(4);

  expect(notExistStepLockLimitReached).toBe(false);
});
