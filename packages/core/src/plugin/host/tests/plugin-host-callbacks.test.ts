import { describe, expect, it } from 'vitest';
import { PluginGuestHandlers } from '@core/plugin/host/plugin-guest-handlers';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';

/**
 * A function inside a payload crosses as a handle and comes back as an async stand-in that invokes the
 * guest — the guest side (`PluginGuestRemote.portable` with a keeper) and the host side
 * (`PluginHostCallbacks.revive`) must agree on the marker, and the stand-in must hand the guest DATA.
 */
describe('callbacks across the process boundary', () => {
  it('replaces functions with stable handles on the guest side, same function → same id, in order', () => {
    const handlers = new PluginGuestHandlers();
    const search = async (q: string) => [q];
    const provider = { slug: 'products', search, nested: { create: () => ({ type: 'x' }) }, again: search };
    const [portable] = PluginGuestRemote.portable([provider], [], (fn) => handlers.keepStable(fn)) as any[];
    expect(portable.search).toEqual({ $fcCallback: 'callback:1' });
    expect(portable.nested.create).toEqual({ $fcCallback: 'callback:2' });
    expect(portable.again).toEqual({ $fcCallback: 'callback:1' });
    expect(handlers.take('callback:1')).toBe(search);
  });

  it('revives handles into stand-ins that invoke the guest with portable arguments', async () => {
    const invoked: Array<{ id: string; args: unknown[] }> = [];
    const callbacks = new PluginHostCallbacks(async (id, args) => { invoked.push({ id, args }); return { ok: true, id }; });
    const revived = callbacks.revive({ slug: 'products', search: { $fcCallback: 'callback:1' }, list: [{ $fcCallback: 'callback:2' }] }) as any;
    expect(typeof revived.search).toBe('function');
    expect(typeof revived.list[0]).toBe('function');

    const fakeRequest = { method: 'GET', path: '/x', headers: { host: 'acme' }, socket: {}, get: () => '', user: { id: 'u1' }, params: { id: '3' }, query: { q: 'a' }, res: { end: () => undefined } };
    const result = await revived.search({ req: fakeRequest, user: fakeRequest.user, fn: () => 1 });
    expect(result).toEqual({ ok: true, id: 'callback:1' });
    const [arg] = invoked[0].args as any[];
    expect(arg.req).toEqual({ method: 'GET', path: '/x', originalUrl: undefined, params: { id: '3' }, query: { q: 'a' }, body: undefined, user: { id: 'u1' }, tenantId: null, headers: { host: 'acme' } });
    expect(arg.fn).toBeUndefined();
    expect(arg.user).toEqual({ id: 'u1' });
  });

  it('leaves data alone and cuts cycles rather than looping', () => {
    const callbacks = new PluginHostCallbacks(async () => undefined);
    const buffer = Buffer.from('b');
    expect(callbacks.revive({ a: 1, when: new Date(0), buffer, list: [1, 'x'] })).toEqual({ a: 1, when: new Date(0), buffer, list: [1, 'x'] });
    const cyclic: any = { name: 'c' };
    cyclic.self = cyclic;
    expect(PluginHostCallbacks.portableArgs([cyclic])).toEqual([{ name: 'c' }]);
  });
});
