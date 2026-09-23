import { PluginInvocationKind } from '@core/plugin/host/enums/plugin-invocation-kind.enum';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * The object another plugin reaches as `context.plugins.namespace(ns).<slug>` when `<slug>` runs
 * ISOLATED. Split out of `PluginHost` when that file passed its size limit.
 */
export class PluginHostPublicApi {
  /** Another plugin's `context.plugins.namespace(...).<slug>.fn()`: the keys are known once the guest has described itself. */
  static lazy(host: any): Record<string, unknown> {
    const method = (name: string) => (...args: unknown[]) => host.invoke(
      { kind: String(PluginInvocationKind.PUBLIC_API.value), name, args },
      RequestContextUtils.storage.getStore(),
    );
    return new Proxy({}, {
      get(_target, prop) {
        if (typeof prop !== 'string') return undefined;
        if (!host.describeResult?.publicApiKeys.includes(prop)) return undefined;
        return method(prop);
      },
      ownKeys() { return host.describeResult?.publicApiKeys ?? []; },
      /**
       * The descriptor carries the FUNCTION, exactly as `get` does.
       *
       * It used to answer `value: undefined`, which reads as "this key exists but holds nothing".
       * Anything that enumerates by descriptor rather than by `get` therefore saw no methods at all —
       * and `PluginHostPortableView.methodNames` does exactly that (`typeof descriptor.value !==
       * 'function'` → skip). With no methods the portable view sends the object as PLAIN DATA, so a
       * guest awaiting another ISOLATED plugin's public API received `{}`: truthy, and empty.
       *
       * That is why a shipping plugin could hold its courier adapter as a peer, pass every `has()`, and
       * still find `searchCities` undefined — and it applied to every guest-to-guest public API call
       * on the platform, not just this pair.
       */
      getOwnPropertyDescriptor(_target, prop) {
        if (typeof prop === 'string' && host.describeResult?.publicApiKeys.includes(prop)) {
          return { enumerable: true, configurable: true, writable: true, value: method(prop) };
        }
        return undefined;
      },
    });
  }
}
