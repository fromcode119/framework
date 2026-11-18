import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginEventDelivery } from '@core/plugin/context/plugin-event-delivery';
import { EventDeliveryLedger } from '@core/plugin/events/event-delivery-ledger';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

/** forHook is where a plugin's hook subscription actually runs; it now also records the outcome. */
describe('PluginEventDelivery.forHook — delivery outcomes reach the ledger', () => {
  afterEach(() => vi.restoreAllMocks());

  const activeManager = (slug: string) => ({ plugins: new Map([[slug, { state: PluginState.ACTIVE }]]), db: {} }) as any;

  it('records a failure when the listener throws, and still re-throws', async () => {
    vi.spyOn(PluginTenantAccess, 'isEnabledForCurrentTenant').mockReturnValue(true);
    const record = vi.spyOn(EventDeliveryLedger, 'recordFailure').mockResolvedValue();
    const wrapped = PluginEventDelivery.forHook(activeManager('sample-keys'), 'sample-keys', async () => { throw new Error('key service down'); });

    await expect(wrapped({ orderId: 1 }, 'sample-shop:order:completed')).rejects.toThrow('key service down');
    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ event: 'sample-shop:order:completed', pluginSlug: 'sample-keys', payload: { orderId: 1 } }),
    );
  });

  it('clears a prior failure when the listener succeeds', async () => {
    vi.spyOn(PluginTenantAccess, 'isEnabledForCurrentTenant').mockReturnValue(true);
    const resolved = vi.spyOn(EventDeliveryLedger, 'markResolved').mockResolvedValue();
    const wrapped = PluginEventDelivery.forHook(activeManager('sample-courses'), 'sample-courses', async () => 'done');

    expect(await wrapped({}, 'sample-shop:order:completed')).toBe('done');
    expect(resolved).toHaveBeenCalledWith(expect.anything(), { event: 'sample-shop:order:completed', pluginSlug: 'sample-courses' });
  });

  it('does not run or record when the plugin is inactive', async () => {
    const record = vi.spyOn(EventDeliveryLedger, 'recordFailure').mockResolvedValue();
    const manager: any = { plugins: new Map([['p', { state: PluginState.INACTIVE }]]), db: {} };
    const handler = vi.fn();

    await PluginEventDelivery.forHook(manager, 'p', handler as any)({}, 'e');
    expect(handler).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
