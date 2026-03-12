// Browser-safe stub for Node.js async_hooks module.
// AsyncLocalStorage is server-only; browser code never calls getStore().
class AsyncLocalStorage {
  constructor() {}
  run(store, fn, ...args) { return fn(...args); }
  getStore() { return undefined; }
  enterWith() {}
  disable() {}
  static bind(fn) { return fn; }
  static snapshot() { return (fn, ...args) => fn(...args); }
}

class AsyncResource {
  constructor() {}
  runInAsyncScope(fn, thisArg, ...args) { return fn.apply(thisArg, args); }
  bind(fn) { return fn; }
  static bind(fn) { return fn; }
}

module.exports = { AsyncLocalStorage, AsyncResource };
