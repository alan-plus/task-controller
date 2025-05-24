import { setTimeout } from "timers/promises";
import { LockController } from "../../src/locks/lock-controller";
import { MultiStepController } from "../../src/tasks/multi-step-controller";

function task(
  result: string,
  timeout: number,
  stepResultsArray: string[][] | null,
  stepLock1: LockController,
  stepLock2: LockController,
  stepLock3: LockController
): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    const release1 = await stepLock1.acquire();
    try {
      await setTimeout(timeout, undefined);
      if (stepResultsArray) {
        stepResultsArray[0]?.push(result);
      }
    } finally {
      release1();
    }

    const release2 = await stepLock2.acquire();
    try {
      await setTimeout(timeout, undefined);
      if (stepResultsArray) {
        stepResultsArray[1]?.push(result);
      }
    } finally {
      release2();
    }

    const release3 = await stepLock3.acquire();
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

test("promise multi step: prevent or allow limited concurrent step execution", async () => {
  const taskExecutor = new MultiStepController<string>({ stepConcurrencies: [1, 2, 2] });
  const stepResultsArray = new Array<string[]>();
  const resultsStep1 = new Array<string>();
  const resultsStep2 = new Array<string>();
  const resultsStep3 = new Array<string>();
  stepResultsArray.push(resultsStep1);
  stepResultsArray.push(resultsStep2);
  stepResultsArray.push(resultsStep3);

  await taskExecutor.runMany([
    (stepLock1: LockController, stepLock2: LockController, stepLock3: LockController) => task("A", 140, stepResultsArray, stepLock1, stepLock2, stepLock3),
    (stepLock1: LockController, stepLock2: LockController, stepLock3: LockController) => task("B", 40, stepResultsArray, stepLock1, stepLock2, stepLock3),
    (stepLock1: LockController, stepLock2: LockController, stepLock3: LockController) => task("C", 5, stepResultsArray, stepLock1, stepLock2, stepLock3),
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

test("multiStepController: method run", async () => {
  const taskExecutor = new MultiStepController<string>({ stepConcurrencies: [1, 2, 2] });
  const stepResultsArray = new Array<string[]>();
  const resultsStep1 = new Array<string>();
  const resultsStep2 = new Array<string>();
  const resultsStep3 = new Array<string>();
  stepResultsArray.push(resultsStep1);
  stepResultsArray.push(resultsStep2);
  stepResultsArray.push(resultsStep3);

  taskExecutor.run((stepLock1: LockController, stepLock2: LockController, stepLock3: LockController) =>
    task("A", 140, stepResultsArray, stepLock1, stepLock2, stepLock3)
  );
  taskExecutor.run((stepLock1: LockController, stepLock2: LockController, stepLock3: LockController) =>
    task("B", 40, stepResultsArray, stepLock1, stepLock2, stepLock3)
  );
  taskExecutor.run((stepLock1: LockController, stepLock2: LockController, stepLock3: LockController) =>
    task("C", 5, stepResultsArray, stepLock1, stepLock2, stepLock3)
  );

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
  const taskExecutor = new MultiStepController<string>({ stepConcurrencies: [1, 1, 1] });

  taskExecutor.run((stepLock1: LockController, stepLock2: LockController, stepLock3: LockController) => task("A", 50, null, stepLock1, stepLock2, stepLock3));
  taskExecutor.run((stepLock1: LockController, stepLock2: LockController, stepLock3: LockController) => task("B", 50, null, stepLock1, stepLock2, stepLock3));
  taskExecutor.run((stepLock1: LockController, stepLock2: LockController, stepLock3: LockController) => task("C", 50, null, stepLock1, stepLock2, stepLock3));

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
  const taskExecutor = new MultiStepController<string>({ stepConcurrencies: [1, 1, 1] });

  const notExistStepLockLimitReached = taskExecutor.isStepLockLimitReached(4);

  expect(notExistStepLockLimitReached).toBe(false);
});
