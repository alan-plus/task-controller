export interface ILock {
  lock(): Promise<ILock>;
  tryLock(): boolean;
  unlock(): void;

}