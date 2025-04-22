export interface Lock {
  lock(): Promise<Lock>;
  tryLock(): boolean;
  unlock(): void;
  locked(): boolean;
}
