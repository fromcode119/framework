import { afterEach, describe, expect, it, vi } from 'vitest';
import { HookManager } from '@core/hooks/hook-manager';
import { PluginOwners } from '@core/plugin/tenant/plugin-owners';
import { SitePluginHookDelivery } from '@core/plugin/tenant/site-plugin-hook-delivery';

describe('a site plugin hears other events, and changes only its own', () => {
  afterEach(() => PluginOwners.forget('skimmer'));

  const order = () => ({ id: 7, total: 120, customer: { email: 'a@b.c', password: 'hunter2', address: { city: 'Sofia' } }, accessToken: 'jwt', items: [{ sku: 'x', apiKey: 'k' }] });

  it('discards a site plugin\'s answer to the platform\'s filter, without waiting for it', async () => {
    PluginOwners.record('skimmer', 'site-a');
    const hooks = new HookManager();
    let release!: () => void;
    const invoke = vi.fn(() => new Promise((resolve) => { release = () => resolve({ ...order(), total: 0 }); }));
    hooks.on('orders-probe:order:beforeCreate', (payload: unknown, ev: string) => SitePluginHookDelivery.deliver('skimmer', ev, payload, invoke));

    const result = await hooks.call('orders-probe:order:beforeCreate', order());

    expect(result).toMatchObject({ total: 120 });
    expect(invoke).toHaveBeenCalledTimes(1);
    release();
  });

  it('hears a copy with every credential-shaped value redacted, and the original untouched', () => {
    PluginOwners.record('skimmer', 'site-a');
    const original = order();
    let heard: any;
    SitePluginHookDelivery.deliver('skimmer', 'user:login', original, async (payload) => { heard = payload; });

    expect(heard.customer.password).toBe(SitePluginHookDelivery.REDACTED);
    expect(heard.accessToken).toBe(SitePluginHookDelivery.REDACTED);
    expect(heard.items[0].apiKey).toBe(SitePluginHookDelivery.REDACTED);
    expect(heard.customer.email).toBe(SitePluginHookDelivery.REDACTED);
    expect(heard.customer.address).toBe(SitePluginHookDelivery.REDACTED);
    expect(heard.total).toBe(120);
    expect(heard.items[0].sku).toBe('x');
    expect(original.customer.password).toBe('hunter2');
  });

  it('removes personal data, and a person\'s plain name, but keeps a product\'s name', () => {
    const copy: any = SitePluginHookDelivery.redact({
      product: { name: 'Mug', price: 9 },
      billing: { name: 'Ana Petrova', city: 'Sofia', postalCode: '1000', phone: '+359' },
      user: { id: 4, firstName: 'Ana', displayName: 'ana', ipAddress: '1.2.3.4' },
      shippingAddress: { line1: 'Street 1' },
    });
    expect(copy.product).toEqual({ name: 'Mug', price: 9 });
    expect(copy.billing).toEqual({ name: '[redacted]', city: 'Sofia', postalCode: '[redacted]', phone: '[redacted]' });
    expect(copy.user).toEqual({ id: 4, firstName: '[redacted]', displayName: '[redacted]', ipAddress: '[redacted]' });
    expect(copy.shippingAddress).toBe('[redacted]');
  });

  it('a failing site listener does not fail the platform\'s call', async () => {
    PluginOwners.record('skimmer', 'site-a');
    const hooks = new HookManager();
    hooks.on('user:login', (payload: unknown, ev: string) => SitePluginHookDelivery.deliver('skimmer', ev, payload, () => Promise.reject(new Error('boom'))));
    await expect(hooks.call('user:login', { id: 1 })).resolves.toEqual({ id: 1 });
  });

  it('keeps a site plugin\'s answer for its OWN event', async () => {
    PluginOwners.record('skimmer', 'site-a');
    const answer = await SitePluginHookDelivery.deliver('skimmer', 'skimmer:quote', { price: 1 }, async () => ({ price: 2 }));
    expect(answer).toEqual({ price: 2 });
  });

  it('leaves a platform plugin\'s listener as it was: awaited, answer kept, nothing redacted', async () => {
    const answer = await SitePluginHookDelivery.deliver('platform-probe', 'orders-probe:order:beforeCreate', order(), async (payload: any) => ({ ...payload, total: 99 }));
    expect(answer).toMatchObject({ total: 99, customer: { password: 'hunter2' } });
  });

  it('copies a shared object twice and drops only a true cycle', () => {
    const place = { city: 'Sofia' };
    const cyclic: any = { from: place, to: place };
    cyclic.self = cyclic;
    const copy: any = SitePluginHookDelivery.redact(cyclic);
    expect(copy.from).toEqual({ city: 'Sofia' });
    expect(copy.to).toEqual({ city: 'Sofia' });
    expect(copy.self).toBeUndefined();
  });
});
