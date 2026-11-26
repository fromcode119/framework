import { describe, expect, it, vi } from 'vitest';
import { PluginGuestPeerNamespace } from '@core/plugin/host/plugin-guest-peer-namespace';

/**
 * `context.plugins.namespace(ns)` inside an ISOLATED plugin.
 *
 * It must behave like the in-process facade, because plugin code cannot tell which world it is in.
 * `has` used to exist only as a Proxy TRAP — the `in` operator — while every caller uses it as a
 * METHOD, so `ns.has('billing')` resolved `has` as a plugin slug, found none, returned undefined and
 * threw "ns.has is not a function". That took a plugin down on every boot.
 *
 * The methods that decide control flow must stay SYNCHRONOUS. A remote chain is always truthy, so
 * answering `has` with one would take the branch for a plugin that is not running — worse than the
 * crash, because nothing reports it.
 */
describe('the guest namespace proxy', () => {
  const build = (peers: string[]) => {
    const state = {
      hasPeer: (_ns: string, slug: string) => peers.includes(slug),
      peerKeys: () => peers.map((slug) => `org.fromcode:${slug}`),
      peerFunctions: (_ns: string, slug: string) => (slug === 'numbers' ? ['contentReadings'] : ['other']),
    };
    const remote = {
      ref: vi.fn((root: string, chain: unknown[]) => ({ __ref: true, root, chain })),
      call: vi.fn(async (_root: string, chain: Array<{ name: string; args?: unknown[] }>) => ({ answered: chain[chain.length - 1].name })),
    };
    // Moved out of PluginGuestContextFactory when that file passed its size limit; same behaviour.
    return PluginGuestPeerNamespace.build('org.fromcode', state, remote) as any;
  };

  it('offering() lists the peers exposing a method, synchronously, from what the guest already knows', () => {
    expect(build(['numbers', 'billing']).offering('contentReadings')).toEqual(['numbers']);
    expect(build(['billing']).offering('contentReadings')).toEqual([]);
  });

  it('answers has() as a METHOD, synchronously', () => {
    const ns = build(['billing']);

    expect(ns.has('billing')).toBe(true);
    expect(ns.has('ledger')).toBe(false);
  });

  it('never answers has() with a truthy remote chain for an absent plugin', () => {
    expect(build([]).has('billing')).toBe(false);
  });

  it('get() is null for an absent plugin, so `if (!api) return` works in both worlds', () => {
    const ns = build(['billing']);

    expect(ns.get('ledger')).toBeNull();
    expect(ns.get('billing')).toMatchObject({ __ref: true });
  });

  it('require() throws for an absent plugin, naming it', () => {
    expect(() => build([]).require('billing')).toThrow(/"billing" is not available/);
  });

  it('still resolves a peer by slug, which is the common case', () => {
    expect(build(['billing']).billing).toMatchObject({ __ref: true });
    expect(build(['billing']).ledger).toBeUndefined();
  });

  it('does not let a facade method name shadow a plugin lookup', () => {
    // A peer literally called "get" must not break the facade's own get().
    const ns = build(['get', 'billing']);

    expect(typeof ns.get).toBe('function');
    expect(ns.get('billing')).toMatchObject({ __ref: true });
  });

  it('refuses hasMethod rather than guessing — the answer lives in the host', () => {
    expect(() => build(['billing']).hasMethod('billing', 'convertAmount'))
      .toThrow(/not available to an isolated plugin/);
  });

  it('sends the async facade calls at once and answers them as promises', async () => {
    const ns = build(['billing']);

    await expect(ns.callOperation('billing', 'refund', 1)).resolves.toEqual({ answered: 'callOperation' });
    expect(ns.getNamespace()).toBe('org.fromcode');
  });

  // A remote chain sends its message on every await. A guest that kept the answer of call() in a cache and
  // awaited it from several callers asked the peer once per await — seven times in one request.
  it('sends a call once however many times its answer is awaited', async () => {
    const remote = { ref: vi.fn(), call: vi.fn(async () => 'value') };
    const ns = PluginGuestPeerNamespace.build('org.fromcode', { hasPeer: () => true, peerKeys: () => [], peerFunctions: () => [] }, remote as any) as any;

    const answer = ns.call('ledger', 'balance', { account: 'a1' });
    expect(await answer).toBe('value');
    expect(await answer).toBe('value');
    expect(await Promise.all([answer, answer])).toEqual(['value', 'value']);
    expect(remote.call).toHaveBeenCalledTimes(1);
    expect(remote.call).toHaveBeenCalledWith('context', [
      { name: 'plugins' }, { name: 'namespace', args: ['org.fromcode'] }, { name: 'call', args: ['ledger', 'balance', { account: 'a1' }] },
    ]);
  });

  it('keeps the `in` operator working', () => {
    expect('billing' in build(['billing'])).toBe(true);
    expect('ledger' in build(['billing'])).toBe(false);
  });
});
