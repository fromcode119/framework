import { describe, expect, it, vi } from 'vitest';
import { PluginGuestPeerNamespace } from '@core/plugin/host/plugin-guest-peer-namespace';

/**
 * An isolated plugin has to be able to ask "is that plugin here?" and get the truth.
 *
 * A remote reference is a lazy chain — every property returns another chain, so it is always truthy.
 * In-process, `namespace('org.fromcode').ledger` is undefined when ledger is not running, and
 * plugins guard on exactly that. Inside a guest the guard passed for a plugin that did not exist, the
 * call went out anyway, and the host answered `cannot read "registerProvider" of null` — after the
 * plugin had logged "provider registered" and set its flag.
 */
describe('an isolated plugin asking for a peer', () => {
  const remote = { ref: vi.fn(() => ({ marker: 'remote-chain' })) } as any;
  const peers = (present: string[]) => ({
    hasPeer: (namespace: string, slug: string) => present.includes(`${namespace}:${slug}`),
    peerKeys: () => [...present],
  });
  const namespaceOf = (present: string[]): Record<string, unknown> =>
    PluginGuestPeerNamespace.build('org.fromcode', peers(present), remote);

  it('hands back a callable reference for a peer that is running', () => {
    const found = namespaceOf(['org.fromcode:catalog']).catalog;

    expect(found).toBeTruthy();
    expect(remote.ref).toHaveBeenCalled();
  });

  /** The whole point: `if (!ledger) return;` must work the same as it does in-process. */
  it('is undefined for a peer that is not running, so the usual guard works', () => {
    expect(namespaceOf(['org.fromcode:catalog']).ledger).toBeUndefined();
  });

  it('answers `in` truthfully too', () => {
    const namespace = namespaceOf(['org.fromcode:catalog']);

    expect('catalog' in namespace).toBe(true);
    expect('ledger' in namespace).toBe(false);
  });
});
