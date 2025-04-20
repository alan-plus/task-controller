import { setTimeout } from 'timers/promises';
import { SimpleLock } from '../../src/locks/simple-lock';

test('simple lock prevent concurrent access to resource', async () => {
  const lock = new SimpleLock();

  const resultsInFinishOrder = new Array<string>();

  const taskA = new Promise<string>(async (resolve, reject) => {
    const result = 'A';
    try{
      await lock.lock();
      await setTimeout(20, undefined);

      resultsInFinishOrder.push(result);
      resolve(result);
    }finally{
      lock.unlock();
    }
  });

  const taskB = new Promise<string>(async (resolve, reject) => {
    const result = 'B';
    try{
      await lock.lock();
      await setTimeout(10, undefined);

      resultsInFinishOrder.push(result);
      resolve(result);
    }finally{
      lock.unlock();
    }
  });

  await Promise.all([taskA, taskB]);

  expect(resultsInFinishOrder[0]).toBe('A');
  expect(resultsInFinishOrder[1]).toBe('B');
});