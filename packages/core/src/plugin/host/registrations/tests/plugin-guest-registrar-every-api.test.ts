import { describe, expect, it } from 'vitest';
import { PluginGuestRegistrar } from '@core/plugin/host/registrations/plugin-guest-registrar';

/**
 * Several api processes hold one plugin process. One that attached later gets the standing record; one
 * already attached must hear each later registration too, or a hook a request registered on api 1 is
 * missing on api 0 and 2.
 */
describe('PluginGuestRegistrar with several api processes holding the plugin', () => {
  const channel = (answer: unknown = true) => {
    const sent: unknown[] = [];
    return { sent, isClosed: false, request: async (_type: string, payload: unknown) => { sent.push(payload); return answer; } };
  };

  it('tells every other api a standing registration and its withdrawal — never a one-shot per-site run', async () => {
    const asked = channel();
    const other = channel();
    const registrar = new PluginGuestRegistrar(asked as any, () => [asked, other] as any);
    await registrar.send({ kind: 'hook', event: 'order.created', handlerId: 'hook:1' });
    await registrar.send({ kind: 'hook-off', event: 'order.created', handlerId: 'hook:1' });
    await registrar.send({ kind: 'tenants-for-each', handlerId: 'tenants:1' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(asked.sent).toHaveLength(3);
    expect(other.sent.map((r: any) => r.kind)).toEqual(['hook', 'hook-off']);
  });

  it('tells nobody else what the asking api suppressed (a per-site replay of onInit)', async () => {
    const asked = channel(PluginGuestRegistrar.SUPPRESSED);
    const other = channel();
    const registrar = new PluginGuestRegistrar(asked as any, () => [asked, other] as any);
    await registrar.send({ kind: 'route', method: 'get', path: '/demo/items' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(other.sent).toEqual([]);
  });

  it('a slow or gone api does not hold up the one that asked', async () => {
    const asked = channel();
    const stuck = { isClosed: false, request: () => new Promise(() => undefined) };
    const registrar = new PluginGuestRegistrar(asked as any, () => [asked, stuck] as any);
    await expect(registrar.send({ kind: 'route', method: 'get', path: '/demo/items' })).resolves.toBe(true);
  });
});
