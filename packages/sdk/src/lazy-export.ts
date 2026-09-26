/**
 * An export that loads its module the first time it is touched, not when the SDK is imported.
 *
 * Every plugin runs in its own process, and `@fromcode119/sdk/server` is imported by nearly all of
 * them. A few of its exports live in heavy packages — the whole api, the image library, the plugin
 * registry — that almost no plugin uses; importing them eagerly put about 70 MB into EVERY plugin
 * process. Through this, a plugin that never touches `APIServer` never loads the api.
 *
 * The value behaves as the real class: static calls, `new`, `instanceof` and property reads all go
 * to it, resolved once and then reused.
 */
export class LazyExport {
  static of<T extends object>(load: () => T): T {
    let target: T | undefined;
    const resolve = (): any => (target ??= load());
    return new Proxy(function lazyExport() {} as unknown as T, {
      get: (_shell, property) => Reflect.get(resolve(), property),
      set: (_shell, property, value) => Reflect.set(resolve(), property, value),
      has: (_shell, property) => Reflect.has(resolve(), property),
      apply: (_shell, self, args) => Reflect.apply(resolve(), self, args),
      construct: (_shell, args, newTarget) => Reflect.construct(resolve(), args, newTarget),
      getPrototypeOf: () => Reflect.getPrototypeOf(resolve()),
    });
  }
}
