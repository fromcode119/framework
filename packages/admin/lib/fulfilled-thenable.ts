/**
 * A thenable that React's `use()` can read WITHOUT suspending.
 *
 * `use()` only returns synchronously for a thenable that already carries React's settled shape
 * (`status: 'fulfilled'` + `value`). A plain `Promise.resolve(x)` does not: `use()` suspends on it once
 * and waits for a retry render. Under a `PureReactor` parent that retry is shallow-compared away — the
 * props are unchanged — so the retry never reaches the suspended child and the route sits on its
 * `loading` fallback forever. That is exactly what stranded a plugin root whose page falls through to a
 * collection list (`/forms` → "Hydrating Interface").
 *
 * Next.js route `params` never hit this because React itself settles and tags those promises before the
 * page renders. Anything WE synthesise has to carry the same shape.
 */
export class FulfilledThenable<T> implements PromiseLike<T> {
  readonly status = 'fulfilled' as const;
  readonly value: T;

  constructor(value: T) {
    this.value = value;
  }

  then<R = T>(onFulfilled?: ((value: T) => R | PromiseLike<R>) | null): PromiseLike<R> {
    return Promise.resolve(onFulfilled ? onFulfilled(this.value) : (this.value as unknown as R));
  }
}
