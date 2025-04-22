import { Lock } from "../interfaces/lock";
import { RunningLockEntry, WaitingLockEntry } from "../interfaces/lock-entry";
import { LockOptions } from "./lock-mutex";

export type PoolLockOptions = LockOptions & { concurrentLimit?: number};

const defaultOptions: Required<PoolLockOptions> = { concurrentLimit: 1, queueType: 'FIFO' };

export class LockPool implements Lock{
  private readonly options: Required<PoolLockOptions>;

  private readonly waitingQueue = new Array<WaitingLockEntry>();
  private readonly runningQueue = new Array<RunningLockEntry>();

  constructor(options?: PoolLockOptions){
    this.options = this.sanitizeOptions(options, defaultOptions);
  }

  public async lock(): Promise<Lock> {
    return new Promise<Lock>((resolve, reject) => {
      const lockEntry = { resolve, reject } satisfies WaitingLockEntry;
      this.waitingQueue.push(lockEntry);
      this.dispatchNextLock();
    });
  }

  public tryLock(): boolean {
    const someOneIsWaitingTheLock = this.waitingQueue.length > 0;
    if(someOneIsWaitingTheLock){
      return false;
    }

    const conncurrentLimitReached = this.runningQueue.length >= this.options.concurrentLimit;
    if (conncurrentLimitReached) {
      return false;
    }

    const lockEntry = { } satisfies RunningLockEntry;
    this.runningQueue.push(lockEntry);

    return true;
  }

  public unlock(): void {
    const lock = this.runningQueue.shift();
    if(!lock){
      return;
    }

    this.dispatchNextLock();
  }

  public locked(): boolean {
    const conncurrentLimitReached = this.runningQueue.length >= this.options.concurrentLimit;

    return conncurrentLimitReached;
  }

  private dispatchNextLock(): void {
    if (this.locked()) {
      return;
    }

    const nextLock = this.getNextLockToRun();
    if (!nextLock) {
      return;
    }

    nextLock.resolve(this);
    this.runningQueue.push(nextLock);
  }

  private getNextLockToRun(): WaitingLockEntry | undefined {
    let lockTask: WaitingLockEntry | undefined;
    switch(this.options.queueType){
      case 'FIFO':
        lockTask = this.waitingQueue.shift();
        break;
      case 'LIFO':
        lockTask =  this.waitingQueue.pop();
        break;
      default:
        lockTask =  this.waitingQueue.shift();
    }

    return lockTask;
  }

  private sanitizeOptions(options: PoolLockOptions | undefined, 
    defaultOptions: Required<PoolLockOptions>): Required<PoolLockOptions> {

    if(options === null || options === undefined || Array.isArray(options) || typeof options !== 'object'){
      return defaultOptions;
    }

    const sanitizedOptions: PoolLockOptions = {...defaultOptions};

    for(const key in defaultOptions){
      const typedKey = key as keyof PoolLockOptions;

      const defaultValue = defaultOptions[typedKey];
      const value = options[typedKey] as any;
      if(value === null || value === undefined){
        continue;
      }

      const defaultValueType = typeof defaultValue;
      const valueType = typeof value;
      if(defaultValueType !== valueType){
        continue;
      }

      sanitizedOptions[typedKey] = value;
    }

    return sanitizedOptions as Required<PoolLockOptions>;
  }
}
