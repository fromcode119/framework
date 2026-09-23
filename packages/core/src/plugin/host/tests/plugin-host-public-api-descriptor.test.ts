import { describe, expect, it } from 'vitest';
import { PluginHostPortableView } from '@core/plugin/host/plugin-host-portable-view';

/**
 * A guest reaching another ISOLATED plugin's public API gets it through the portable view, and the
 * portable view decides what an object IS by enumerating its methods with
 * `Object.getOwnPropertyDescriptor(...).value`.
 *
 * `PluginHost.lazyPublicApi` answered that descriptor with `value: undefined` while its `get` trap
 * returned the real function. So every method was skipped, `methods.length` was 0, and the object
 * crossed as PLAIN DATA — the guest received `{}`: truthy, and empty.
 *
 * On a client site that is why a shipping plugin held its courier adapter as a peer, passed every
 * `has()` check, and still found `searchCities` undefined. It applied to every guest-to-guest
 * public API call on the platform, not just that pair.
 */
describe('an isolated plugin public API survives the portable view', () => {
  const keys = ['getCapabilities', 'resolveCities', 'searchCities', 'searchOffices'];

  /** The shape `lazyPublicApi` builds, with the descriptor fixed to carry the function. */
  const publicApiProxy = () => {
    const method = (name: string) => (...args: unknown[]) => ({ called: name, args });
    return new Proxy({}, {
      get: (_t, prop) => (typeof prop === 'string' && keys.includes(prop) ? method(prop) : undefined),
      ownKeys: () => keys,
      getOwnPropertyDescriptor: (_t, prop) => (typeof prop === 'string' && keys.includes(prop)
        ? { enumerable: true, configurable: true, writable: true, value: method(prop) }
        : undefined),
    });
  };

  it('crosses as a host object carrying its methods, not as plain data', () => {
    const view: any = PluginHostPortableView.of(publicApiProxy(), "shipping-adapter");
    const marker = view?.[PluginHostPortableView.MARKER];

    expect(marker, 'the API must cross as a host object, not as {}').toBeTruthy();
    expect(marker.methods).toContain('searchCities');
    expect(marker.methods).toEqual(expect.arrayContaining(keys));
  });

  it('is NOT mistaken for plain data the way the old descriptor made it', () => {
    // The old shape: `get` returned a function but the descriptor said `value: undefined`.
    const old = new Proxy({}, {
      get: (_t, prop) => (typeof prop === 'string' && keys.includes(prop) ? () => undefined : undefined),
      ownKeys: () => keys,
      getOwnPropertyDescriptor: (_t, prop) => (typeof prop === 'string' && keys.includes(prop)
        ? { enumerable: true, configurable: true, value: undefined }
        : undefined),
    });

    const brokenView: any = PluginHostPortableView.of(old, "shipping-adapter");
    expect(brokenView?.[PluginHostPortableView.MARKER], 'regression guard: this is the bug').toBeFalsy();
  });
});
