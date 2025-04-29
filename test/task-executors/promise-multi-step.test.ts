import { setTimeout } from "timers/promises";
import { PromiseMultiStep } from "../../src/task-executors/promise-multi-step";
import { Lock } from "../../src/interfaces/lock";

function task(result: string, timeout: number, stepResultsArray: string[][], stepLock1: Lock, stepLock2: Lock, stepLock3: Lock): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    const release1 = await stepLock1.acquire();
    try {
      await setTimeout(timeout, undefined);
      stepResultsArray[0]?.push(result);
    } finally {
      release1();
    }

    const release2 = await stepLock2.acquire();
    try {
      await setTimeout(timeout, undefined);
      stepResultsArray[1]?.push(result);
    } finally {
      release2();
    }

    const release3 = await stepLock3.acquire();
    try {
      await setTimeout(timeout, undefined);
      stepResultsArray[2]?.push(result);
    } finally {
      release3();
    }

    resolve(result);
  });
}

test("promise multi step: prevent or allow limited concurrent step execution", async () => {
  const taskExecutor = new PromiseMultiStep<string>({ stepConcurrentLimits: [1, 2, 2] });
  const stepResultsArray = new Array<string[]>();
  const resultsStep1 = new Array<string>();
  const resultsStep2 = new Array<string>();
  const resultsStep3 = new Array<string>();
  stepResultsArray.push(resultsStep1);
  stepResultsArray.push(resultsStep2);
  stepResultsArray.push(resultsStep3);

  await taskExecutor.runMany([
    (stepLock1: Lock, stepLock2: Lock, stepLock3: Lock) => task("A", 140, stepResultsArray, stepLock1, stepLock2, stepLock3),
    (stepLock1: Lock, stepLock2: Lock, stepLock3: Lock) => task("B", 40, stepResultsArray, stepLock1, stepLock2, stepLock3),
    (stepLock1: Lock, stepLock2: Lock, stepLock3: Lock) => task("C", 5, stepResultsArray, stepLock1, stepLock2, stepLock3),
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

test("promise multi step: method run", async () => {
  const taskExecutor = new PromiseMultiStep<string>({ stepConcurrentLimits: [1, 2, 2] });
  const stepResultsArray = new Array<string[]>();
  const resultsStep1 = new Array<string>();
  const resultsStep2 = new Array<string>();
  const resultsStep3 = new Array<string>();
  stepResultsArray.push(resultsStep1);
  stepResultsArray.push(resultsStep2);
  stepResultsArray.push(resultsStep3);

  taskExecutor.run((stepLock1: Lock, stepLock2: Lock, stepLock3: Lock) => task("A", 140, stepResultsArray, stepLock1, stepLock2, stepLock3));
  taskExecutor.run((stepLock1: Lock, stepLock2: Lock, stepLock3: Lock) => task("B", 40, stepResultsArray, stepLock1, stepLock2, stepLock3));
  taskExecutor.run((stepLock1: Lock, stepLock2: Lock, stepLock3: Lock) => task("C", 5, stepResultsArray, stepLock1, stepLock2, stepLock3));

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
