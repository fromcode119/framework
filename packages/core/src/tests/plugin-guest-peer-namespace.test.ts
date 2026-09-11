import { describe, expect, it, vi } from 'vitest';
import { PluginGuestContextFactory } from '@core/plugin/host/plugin-guest-context-factory';

/**
 * An isolated plugin has to be able to ask "is that plugin here?" and get the truth.
 *
 * A remote reference is a lazy chain — every property returns another chain, so it is always truthy.
 * In-process, `namespace('org.fromcode').broadcasts` is undefined when broadcasts is not running, and
 * plugins guard on exactly that. Inside a guest the guard passed for a plugin that did not exist, the
 * call went out anyway, and the host answered `cannot read "registerProvider" of null` — after the
 * plugin had logged "broadcast provider registered" and set its flag.
 */
describe('an isolated plugin asking for a peer', () => {
  const remote = { ref: vi.fn(() => ({ marker: 'remote-chain' })) } as any;
  const peers = (present: string[]) => ({
    hasPeer: (namespace: string, slug: string) => present.includes(`${namespace}:${slug}`),
  });
  const namespaceOf = (present: string[]): Record<string, unknown> =>
    (PluginGuestContextFactory as any).peerNamespace('org.fromcode', peers(present), remote);

  it('hands back a callable reference for a peer that is running', () => {
    const found = namespaceOf(['org.fromcode:ecommerce']).ecommerce;

    expect(found).toBeTruthy();
    expect(remote.ref).toHaveBeenCalled();
  });

  /** The whole point: `if (!broadcasts) return;` must work the same as it does in-process. */
  it('is undefined for a peer that is not running, so the usual guard works', () => {
    expect(namespaceOf(['org.fromcode:ecommerce']).broadcasts).toBeUndefined();
  });

  it('answers `in` truthfully too', () => {
    const namespace = namespaceOf(['org.fromcode:ecommerce']);

    expect('ecommerce' in namespace).toBe(true);
    expect('broadcasts' in namespace).toBe(false);
  });
});
