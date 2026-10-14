/**
 * A safe stand-in for the `org.fromcode` namespace where no provider exists (the admin's block previews).
 * Every lookup answers null, so callers render nothing instead of throwing.
 */
export class NullPluginsFacade {
  static create(): any {
    const base = {
      isReady: false,
      get: (_slug: string) => null,
      has: (_slug: string) => false,
      require: (_slug: string) => null,
    };
    return new Proxy(base, {
      get(target, prop, receiver) {
        if (prop in target || typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
        return null;
      },
    });
  }
}
