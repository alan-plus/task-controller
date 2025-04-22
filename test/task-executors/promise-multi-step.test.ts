import { setTimeout } from "timers/promises";
import { PromiseMultiStep } from "../../src/task-executors/promise-multi-step";
import { Lock } from "../../src/interfaces/lock";

function task(result: string, timeout: number, stepResultsArray: string[][], stepLock1: Lock, stepLock2: Lock, stepLock3: Lock): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    try {
      await stepLock1.lock();
      await setTimeout(timeout, undefined);
      stepResultsArray[0].push(result);
    } finally {
      stepLock1.unlock();
    }

    try {
      await stepLock2.lock();
      await setTimeout(timeout, undefined);
      stepResultsArray[1].push(result);
    } finally {
      stepLock2.unlock();
    }

    try {
      await stepLock3.lock();
      await setTimeout(timeout, undefined);
      stepResultsArray[2].push(result);
    } finally {
      stepLock3.unlock();
    }

    resolve(result);
  });
}

test("promise multi step: prevent or allow limited concurrent step execution", async () => {
  const taskExecutor = new PromiseMultiStep<string>({ stepConcurrentLimits: [1, 2, 2] });
  const stepResultsArray = new Array<string[]>();
  stepResultsArray.push(new Array<string>());
  stepResultsArray.push(new Array<string>());
  stepResultsArray.push(new Array<string>());

  await taskExecutor.runMany([
    (stepLock1: Lock, stepLock2: Lock, stepLock3: Lock) => task("A", 140, stepResultsArray, stepLock1, stepLock2, stepLock3),
    (stepLock1: Lock, stepLock2: Lock, stepLock3: Lock) => task("B", 40, stepResultsArray, stepLock1, stepLock2, stepLock3),
    (stepLock1: Lock, stepLock2: Lock, stepLock3: Lock) => task("C", 5, stepResultsArray, stepLock1, stepLock2, stepLock3),
  ]);

  expect(stepResultsArray[0][0]).toBe("A");
  expect(stepResultsArray[0][1]).toBe("B");
  expect(stepResultsArray[0][2]).toBe("C");

  expect(stepResultsArray[1][0]).toBe("B");
  expect(stepResultsArray[1][1]).toBe("C");
  expect(stepResultsArray[1][2]).toBe("A");

  expect(stepResultsArray[2][0]).toBe("C");
  expect(stepResultsArray[2][1]).toBe("B");
  expect(stepResultsArray[2][2]).toBe("A");
});

test("promise multi step: method run", async () => {
  const taskExecutor = new PromiseMultiStep<string>({ stepConcurrentLimits: [1, 2, 2] });
  const stepResultsArray = new Array<string[]>();
  stepResultsArray.push(new Array<string>());
  stepResultsArray.push(new Array<string>());
  stepResultsArray.push(new Array<string>());

  taskExecutor.run((stepLock1: Lock, stepLock2: Lock, stepLock3: Lock) => task("A", 140, stepResultsArray, stepLock1, stepLock2, stepLock3));
  taskExecutor.run((stepLock1: Lock, stepLock2: Lock, stepLock3: Lock) => task("B", 40, stepResultsArray, stepLock1, stepLock2, stepLock3));
  taskExecutor.run((stepLock1: Lock, stepLock2: Lock, stepLock3: Lock) => task("C", 5, stepResultsArray, stepLock1, stepLock2, stepLock3));

  await setTimeout(600, undefined);

  expect(stepResultsArray[0][0]).toBe("A");
  expect(stepResultsArray[0][1]).toBe("B");
  expect(stepResultsArray[0][2]).toBe("C");

  expect(stepResultsArray[1][0]).toBe("B");
  expect(stepResultsArray[1][1]).toBe("C");
  expect(stepResultsArray[1][2]).toBe("A");

  expect(stepResultsArray[2][0]).toBe("C");
  expect(stepResultsArray[2][1]).toBe("B");
  expect(stepResultsArray[2][2]).toBe("A");
});
