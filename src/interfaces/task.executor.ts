export interface TaskExecutor<T> {
  run<T>(task: () => Promise<T>): Promise<T>;
  runMany<T>(tasks: Array<() => Promise<T>>): Promise<T[]>;
  releaseAll(): void;
}