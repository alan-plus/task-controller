import { ILock } from "../interfaces/lock";
import { QueueType } from "../types/queue.type";
import { PoolLock, PoolLockOptions } from "./pool-lock";

export type LockOptions = { queueType?: QueueType };

export class MutexLock implements ILock{
  private readonly poolLock: PoolLock;

  constructor(options?: LockOptions){
    if(!options){
      options = {};
    }

    this.poolLock = new PoolLock({...options, concurrent: 1} as PoolLockOptions);
  }

  public async lock(): Promise<ILock> {
    return await this.poolLock.lock();
  }

  public tryLock(): boolean {
    return this.poolLock.tryLock();
  }

  public unlock(): void {
    this.poolLock.unlock();
  }
}
