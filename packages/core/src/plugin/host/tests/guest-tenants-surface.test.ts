import { describe, expect, it, vi } from 'vitest';
import { PluginGuestContextFactory } from '@core/plugin/host/plugin-guest-context-factory';
import { TenantsContextProxy } from '@core/plugin/context/tenants';

/**
 * An ISOLATED plugin's `context.tenants` must offer what an in-process one does.
 *
 * The guest surface is hand-written — an isolated plugin runs in its own process with no database
 * connection and no tenant resolver, so each method is forwarded to the host rather than inherited.
 * That means a method added to the in-process proxy and not to this list does not degrade: it is
 * simply ABSENT, and the guest gets `is not a function` the first time it asks.
 *
 * Which is how it was found — `baseUrls` shipped on the in-process proxy only, and the first isolated
 * plugin to resolve a link for an email threw on a production install.
 *
 * So this compares the two surfaces rather than checking one name, and any future addition to the
 * in-process proxy fails here until it is forwarded too.
 */
const guestTenants = () => {
  const remote = { call: vi.fn(async () => undefined), ref: vi.fn(() => ({})) };
  const factory = Object.create(PluginGuestContextFactory.prototype);
  Object.assign(factory, {
    remote,
    handlers: { keep: vi.fn(() => 'handler-1') },
    channel: {}, http: {}, state: {}, boot: {},
    scheduler: () => ({}),
    registerTools: vi.fn(),
  });
  // `create()` builds the whole context; the tenants block is what this suite is about.
  const context: any = factory.create ? factory.create.call(factory) : null;
  return { tenants: context?.tenants, remote };
};

describe('isolated guest context.tenants', () => {
  it('offers every method the in-process proxy does', () => {
    const inProcess = TenantsContextProxy.createTenantsProxy({} as never, 'example');
    const { tenants } = guestTenants();

    for (const name of Object.keys(inProcess)) {
      expect(typeof (tenants as any)?.[name], `guest is missing "${name}"`).toBe('function');
    }
  });

  it('forwards baseUrls to the host — the guest cannot answer it itself', async () => {
    const { tenants, remote } = guestTenants();

    await (tenants as any).baseUrls();

    expect(remote.call).toHaveBeenCalledWith('context', [
      { name: 'tenants' },
      { name: 'baseUrls', args: [] },
    ]);
  });
});
