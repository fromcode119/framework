import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventDeliveryLedger } from '@core/plugin/events/event-delivery-ledger';
import { EventListenerRegistry } from '@core/plugin/events/event-listener-registry';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

function rawRow(r: any) {
  return {
    id: r.id, event: r.event, plugin_slug: r.pluginSlug, tenant_id: r.tenantId ?? null,
    attempts: 1, error: 'x', payload: JSON.stringify(r.payload ?? null), updated_at: 'now',
  };
}

function managerWithRow(row: any) {
  const update = vi.fn(async () => {});
  const withTenant = vi.fn(async (_tenant: string, fn: any) => fn());
  const db = {
    findOne: vi.fn(async (_table: string, where: any) => (where.id === row?.id ? rawRow(row) : null)),
    update,
    withTenant,
  };
  return { manager: { db } as any, update, withTenant };
}

describe('EventListenerRegistry', () => {
  it('registers, finds and unregisters a handler by (event, plugin)', () => {
    const handler = async () => {};
    EventListenerRegistry.register('e', 'p', handler);
    expect(EventListenerRegistry.find('e', 'p')).toContain(handler);
    EventListenerRegistry.unregister('e', 'p', handler);
    expect(EventListenerRegistry.find('e', 'p')).not.toContain(handler);
  });
});

describe('EventDeliveryLedger.retry', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns notFound when the delivery id is unknown', async () => {
    const { manager } = managerWithRow({ id: 1, event: 'e', pluginSlug: 'p' });
    expect(await EventDeliveryLedger.retry(manager, 999)).toMatchObject({ ok: false, notFound: true });
  });

  it('refuses to retry a disabled plugin (its listener would no-op and falsely resolve the row)', async () => {
    const row = { id: 7, event: 'ord:done', pluginSlug: 'offplugin', tenantId: null, payload: {} };
    const { manager, update } = managerWithRow(row);
    manager.plugins = new Map([['offplugin', { state: PluginState.INACTIVE }]]);
    const handler = vi.fn(async () => {});
    EventListenerRegistry.register('ord:done', 'offplugin', handler);
    try {
      const res = await EventDeliveryLedger.retry(manager, 7);
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/not enabled/i);
      expect(handler).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    } finally {
      EventListenerRegistry.unregister('ord:done', 'offplugin', handler);
    }
  });

  it('reports when no listener is registered now (plugin off / never re-subscribed)', async () => {
    const { manager } = managerWithRow({ id: 2, event: 'no:listener', pluginSlug: 'gone' });
    const res = await EventDeliveryLedger.retry(manager, 2);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/No active listener/);
  });

  it('re-runs the current listener in the row\'s tenant and resolves the row on success', async () => {
    const row = { id: 3, event: 'ord:done', pluginSlug: 'sample-courses', tenantId: 42, payload: { orderId: 9 } };
    const { manager, update, withTenant } = managerWithRow(row);
    const handler = vi.fn(async () => {});
    EventListenerRegistry.register('ord:done', 'sample-courses', handler);
    try {
      const res = await EventDeliveryLedger.retry(manager, 3);
      expect(res.ok).toBe(true);
      expect(handler).toHaveBeenCalledWith({ orderId: 9 }, 'ord:done');
      expect(withTenant).toHaveBeenCalledWith('42', expect.any(Function));
      expect(update).toHaveBeenCalledWith(expect.any(String), { id: 3 }, expect.objectContaining({ status: 'resolved' }));
    } finally {
      EventListenerRegistry.unregister('ord:done', 'sample-courses', handler);
    }
  });

  it('reports the error when the retried listener throws, and does not resolve the row', async () => {
    const row = { id: 4, event: 'ord:done2', pluginSlug: 'sample-courses2', tenantId: null, payload: {} };
    const { manager, update } = managerWithRow(row);
    const handler = vi.fn(async () => { throw new Error('still broken'); });
    EventListenerRegistry.register('ord:done2', 'sample-courses2', handler);
    try {
      const res = await EventDeliveryLedger.retry(manager, 4);
      expect(res).toMatchObject({ ok: false });
      expect(res.error).toMatch(/still broken/);
      expect(update).not.toHaveBeenCalled();
    } finally {
      EventListenerRegistry.unregister('ord:done2', 'sample-courses2', handler);
    }
  });
});
