import { describe, expect, it } from 'vitest';
import { PluginGuestRegistrar } from '@core/plugin/host/registrations/plugin-guest-registrar';

/** The plugin process's own record of what it registered — what an api that did not start it learns from. */
describe('PluginGuestRegistrar', () => {
  const channel = () => {
    const sent: unknown[] = [];
    return { sent, request: async (_type: string, payload: unknown) => { sent.push(payload); return 3; } };
  };

  it('sends every registration and keeps the standing ones in order', async () => {
    const transport = channel();
    const registrar = new PluginGuestRegistrar(transport as any);
    await registrar.send({ kind: 'route', method: 'get', path: '/demo/items' });
    await registrar.send({ kind: 'hook', event: 'order.created', handlerId: 'hook:1' });
    await registrar.send({ kind: 'scheduler', name: 'nightly', schedule: '0 3 * * *', handlerId: 'scheduler:1' });
    expect(transport.sent).toHaveLength(3);
    expect(registrar.snapshot().map((r) => r.kind)).toEqual(['route', 'hook', 'scheduler']);
  });

  it('drops a hook the plugin withdrew, and never keeps a one-shot per-site run', async () => {
    const transport = channel();
    const registrar = new PluginGuestRegistrar(transport as any);
    await registrar.send({ kind: 'hook', event: 'a', handlerId: 'hook:1' });
    await registrar.send({ kind: 'hook', event: 'b', handlerId: 'hook:2' });
    await registrar.send({ kind: 'hook-off', event: 'a', handlerId: 'hook:1' });
    expect(await registrar.send({ kind: 'tenants-for-each', handlerId: 'tenants:1' })).toBe(3);
    expect(transport.sent).toHaveLength(4);
    expect(registrar.snapshot()).toEqual([{ kind: 'hook', event: 'b', handlerId: 'hook:2' }]);
  });

  it('hands out copies, so a caller cannot rewrite the record', async () => {
    const registrar = new PluginGuestRegistrar(channel() as any);
    await registrar.send({ kind: 'route', method: 'get', path: '/demo/x' });
    registrar.snapshot()[0].path = '/changed';
    expect(registrar.snapshot()[0].path).toBe('/demo/x');
  });

  it('forgets what the api answered it ignored — a per-site replay of onInit — and keeps the rest in order', async () => {
    const sent: any[] = [];
    const transport = { request: async (_type: string, payload: any) => { sent.push(payload); return payload.replay ? PluginGuestRegistrar.SUPPRESSED : true; } };
    const registrar = new PluginGuestRegistrar(transport as any);
    await registrar.send({ kind: 'middleware', handlerId: 'middleware:1', middleware: { id: 'gate', stage: 'post_auth' } });
    await registrar.send({ kind: 'hook', event: 'a', handlerId: 'hook:1' });
    await registrar.send({ kind: 'middleware', handlerId: 'middleware:2', middleware: { id: 'gate', stage: 'post_auth' }, replay: true } as any);
    await registrar.send({ kind: 'hook-off', event: 'a', handlerId: 'hook:1', replay: true } as any);
    expect(sent).toHaveLength(4);
    expect(registrar.snapshot().map((r) => r.handlerId)).toEqual(['middleware:1', 'hook:1']);
  });
});

