import { describe, expect, it, vi } from 'vitest';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';
import { PluginGuestMemo } from '@core/plugin/host/plugin-guest-memo';
import { MemoContextProxy } from '@core/plugin/context/memo';

/**
 * A shop priced every product list by first asking the ledger for its pricing setup — a round trip
 * between two plugin processes — and the ledger read its currency table for it every time. Measured on
 * the bench, keeping those answers per site lifted uncached product lists by half.
 */
describe('context.memo in a plugin process', () => {
  const at = <T>(tenantId: string | null, revision: string | undefined, fn: () => Promise<T>, cacheMaxAgeMs = 60_000) =>
    PluginGuestRemote.invocation.run({ token: `t${Math.random()}`, tenantId, revision, cacheMaxAgeMs }, fn);

  it('works an answer out once per site and revision', async () => {
    const memo = new PluginGuestMemo().api();
    const compute = vi.fn(async () => ({ defaultCurrency: 'EUR', taxRatePercent: 20 }));
    for (let i = 0; i < 3; i += 1) expect(await at('shop', 'r1', () => memo.forSite('pricing', compute))).toEqual({ defaultCurrency: 'EUR', taxRatePercent: 20 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('works it out again once anything on the site changed (a new revision)', async () => {
    const memo = new PluginGuestMemo().api();
    let rate = 20;
    const compute = vi.fn(async () => ({ taxRatePercent: rate }));
    await at('shop', 'r1', () => memo.forSite('pricing', compute));
    rate = 25;
    expect(await at('shop', 'r2', () => memo.forSite('pricing', compute))).toEqual({ taxRatePercent: 25 });
  });

  it('never answers one site with another site\'s answer, and keys stay apart', async () => {
    const memo = new PluginGuestMemo().api();
    const compute = vi.fn(async () => ({ site: PluginGuestRemote.invocation.getStore()?.tenantId }));
    expect(await at('shop', 'r1', () => memo.forSite('pricing', compute))).toEqual({ site: 'shop' });
    expect(await at('blog', 'r1', () => memo.forSite('pricing', compute))).toEqual({ site: 'blog' });
    expect(await at('shop', 'r1', () => memo.forSite('other', async () => 'other'))).toBe('other');
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('keeps nothing with the operator\'s cache off, or without a revision', async () => {
    const memo = new PluginGuestMemo().api();
    const compute = vi.fn(async () => 1);
    await at('shop', 'r1', () => memo.forSite('k', compute), 0);
    await at('shop', 'r1', () => memo.forSite('k', compute), 0);
    await at('shop', undefined, () => memo.forSite('k', compute));
    await memo.forSite('k', compute);
    expect(compute).toHaveBeenCalledTimes(4);
  });

  it('hands every caller its own copy, and does not keep a failure', async () => {
    const memo = new PluginGuestMemo().api();
    const first = await at('shop', 'r1', () => memo.forSite('cfg', async () => ({ rates: new Map([['EUR', 1]]) })));
    first.rates.set('EUR', 99);
    expect((await at('shop', 'r1', () => memo.forSite('cfg', async () => ({ rates: new Map() })))).rates.get('EUR')).toBe(1);

    const failing = vi.fn().mockRejectedValueOnce(new Error('peer down')).mockResolvedValueOnce('ok');
    await expect(at('shop', 'r1', () => memo.forSite('f', failing))).rejects.toThrow('peer down');
    expect(await at('shop', 'r1', () => memo.forSite('f', failing))).toBe('ok');
  });
});

describe('context.memo on the api side', () => {
  it('always works the answer out — plugin processes keep their own', async () => {
    const memo = MemoContextProxy.createMemoProxy();
    const compute = vi.fn(async () => 'fresh');
    await memo.forSite('k', compute);
    await memo.forSite('k', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
