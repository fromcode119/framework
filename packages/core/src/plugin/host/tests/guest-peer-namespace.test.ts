import { describe, expect, it, vi } from 'vitest';
import { PluginGuestContextFactory } from '@core/plugin/host/plugin-guest-context-factory';

/**
 * `context.plugins.namespace(ns)` inside an ISOLATED plugin.
 *
 * It must behave like the in-process facade, because plugin code cannot tell which world it is in.
 * `has` used to exist only as a Proxy TRAP — the `in` operator — while every caller uses it as a
 * METHOD, so `ns.has('finance')` resolved `has` as a plugin slug, found none, returned undefined and
 * threw "ns.has is not a function". That took mlm down on every boot.
 *
 * The methods that decide control flow must stay SYNCHRONOUS. A remote chain is always truthy, so
 * answering `has` with one would take the branch for a plugin that is not running — worse than the
 * crash, because nothing reports it.
 */
describe('the guest namespace proxy', () => {
  const build = (peers: string[]) => {
    const state = { hasPeer: (_ns: string, slug: string) => peers.includes(slug) };
    const remote = { ref: vi.fn((root: string, chain: unknown[]) => ({ __ref: true, root, chain })) };
    return (PluginGuestContextFactory as any).peerNamespace('org.fromcode', state, remote) as any;
  };

  it('answers has() as a METHOD, synchronously', () => {
    const ns = build(['finance']);

    expect(ns.has('finance')).toBe(true);
    expect(ns.has('broadcasts')).toBe(false);
  });

  it('never answers has() with a truthy remote chain for an absent plugin', () => {
    expect(build([]).has('finance')).toBe(false);
  });

  it('get() is null for an absent plugin, so `if (!api) return` works in both worlds', () => {
    const ns = build(['finance']);

    expect(ns.get('broadcasts')).toBeNull();
    expect(ns.get('finance')).toMatchObject({ __ref: true });
  });

  it('require() throws for an absent plugin, naming it', () => {
    expect(() => build([]).require('finance')).toThrow(/"finance" is not available/);
  });

  it('still resolves a peer by slug, which is the common case', () => {
    expect(build(['finance']).finance).toMatchObject({ __ref: true });
    expect(build(['finance']).broadcasts).toBeUndefined();
  });

  it('does not let a facade method name shadow a plugin lookup', () => {
    // A peer literally called "get" must not break the facade's own get().
    const ns = build(['get', 'finance']);

    expect(typeof ns.get).toBe('function');
    expect(ns.get('finance')).toMatchObject({ __ref: true });
  });

  it('refuses hasMethod rather than guessing — the answer lives in the host', () => {
    expect(() => build(['finance']).hasMethod('finance', 'convertAmount'))
      .toThrow(/not available to an isolated plugin/);
  });

  it('forwards the async facade calls as remote chains', () => {
    const ns = build(['finance']);

    expect(ns.callOperation('finance', 'refund', 1)).toMatchObject({ __ref: true });
    expect(ns.getNamespace()).toBe('org.fromcode');
  });

  it('keeps the `in` operator working', () => {
    expect('finance' in build(['finance'])).toBe(true);
    expect('broadcasts' in build(['finance'])).toBe(false);
  });
});
