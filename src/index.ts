import * as Locks from "./locks/lock-mutex";

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export { Locks };
