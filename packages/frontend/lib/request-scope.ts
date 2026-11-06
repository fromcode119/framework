import { AsyncLocalStorage } from 'node:async_hooks';
import { cache } from 'react';

/**
 * One storefront request's memo, so a payload every step of a render asks for is fetched once.
 *
 * React `cache()` only memoises inside a React SERVER COMPONENT render. The storefront document is
 * served by a route handler (`fc-document`), where `cache()` is a plain pass-through — measured: three
 * calls ran the fetch three times. So every reader of `/system/frontend`, `/system/i18n` and
 * `/system/resolve` made its own round trip to the api, one after another, and every page paid for
 * all of them: about a second, on every path, 404s included.
 *
 * `run` opens the scope for one request; `memo` dedupes by argument inside it (primitives by value,
 * objects by identity — the same rule as `cache()`). Outside a scope it falls back to React `cache()`,
 * so a server component render keeps the memo it already had. Nothing outlives the request.
 */
export class RequestScope {
  private static readonly storage = new AsyncLocalStorage<Map<unknown, Map<string, unknown>>>();
  private static readonly objectIds = new WeakMap<object, number>();
  private static nextObjectId = 0;

  static run<T>(work: () => Promise<T>): Promise<T> {
    return RequestScope.storage.run(new Map(), work);
  }

  static memo<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    const outsideScope = cache(fn);
    return (...args: A): R => {
      const store = RequestScope.storage.getStore();
      if (!store) return outsideScope(...args);
      let entries = store.get(fn);
      if (!entries) {
        entries = new Map();
        store.set(fn, entries);
      }
      const key = args.map((arg) => RequestScope.keyOf(arg)).join('\u0000');
      if (!entries.has(key)) entries.set(key, fn(...args));
      return entries.get(key) as R;
    };
  }

  private static keyOf(value: unknown): string {
    if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
      let id = RequestScope.objectIds.get(value);
      if (id === undefined) {
        id = ++RequestScope.nextObjectId;
        RequestScope.objectIds.set(value, id);
      }
      return `o${id}`;
    }
    return `${typeof value}:${String(value)}`;
  }
}
