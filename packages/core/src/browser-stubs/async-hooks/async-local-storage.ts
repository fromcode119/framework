/**
 * Browser-safe stand-in for Node's `AsyncLocalStorage` (`async_hooks`). Server-only by nature; browser
 * code never calls `getStore()`, so this runs callbacks inline and stores nothing.
 */
export class AsyncLocalStorage<T = unknown> {
  run<R>(_store: T, fn: (...args: unknown[]) => R, ...args: unknown[]): R { return fn(...args); }
  getStore(): T | undefined { return undefined; }
  enterWith(_store: T): void { /* nothing to enter in a browser */ }
  disable(): void { /* nothing to disable */ }
  static bind<F extends (...args: unknown[]) => unknown>(fn: F): F { return fn; }
  static snapshot(): (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => unknown { return (fn, ...args) => fn(...args); }
}
