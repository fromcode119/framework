import { describe, expect, it } from 'vitest';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';

function remoteWithRecorder(): { remote: PluginGuestRemote; calls: any[] } {
  const calls: any[] = [];
  const channel = {
    request: async (_type: string, payload: any) => { calls.push(payload); return 'ok'; },
  } as unknown as PluginChannel;
  return { remote: new PluginGuestRemote(channel, 1000), calls };
}

describe('PluginGuestRemote', () => {
  it('turns a property/call chain into ONE message when awaited', async () => {
    const { remote, calls } = remoteWithRecorder();
    const context = remote.ref('context');
    const result = await context.plugins.namespace('org.x').ledger.record({ id: 7 });
    expect(result).toBe('ok');
    expect(calls).toEqual([{
      root: 'context',
      steps: [{ name: 'plugins' }, { name: 'namespace', args: ['org.x'] }, { name: 'ledger' }, { name: 'record', args: [{ id: 7 }] }],
      token: null,
    }]);
  });

  it('sends a data call the moment it is invoked — a plugin that never awaits still gets its registration through', async () => {
    const { remote, calls } = remoteWithRecorder();
    remote.ref('context').settings.register({ key: 'x' });
    expect(calls).toHaveLength(1);
    expect(calls[0].steps).toEqual([{ name: 'settings' }, { name: 'register', args: [{ key: 'x' }] }]);
  });

  it('keeps a handle-returning call lazy so the chain can continue into the peer plugin', async () => {
    const { remote, calls } = remoteWithRecorder();
    const api = remote.ref('context').plugins.namespace('org.x');
    expect(calls).toHaveLength(0);
    await api.mlm.record(1);
    expect(calls).toHaveLength(1);
  });

  it('carries the current invocation token from the guest\'s async context', async () => {
    const { remote, calls } = remoteWithRecorder();
    await PluginGuestRemote.invocation.run({ token: 'route:abc', tenantId: 't1' }, () => remote.ref('context').db.find('t', {}));
    expect(calls[0].token).toBe('route:abc');
  });

  it('drops functions anywhere in the arguments and NAMES each one, rather than failing the call', () => {
    const dropped: string[] = [];
    const out = PluginGuestRemote.portable([() => 1, { slug: 'x', hidden: () => true, fields: [{ validate: () => 1 }] }], dropped);
    expect(out).toEqual([undefined, { slug: 'x', fields: [{}] }]);
    expect(dropped).toEqual(['arg0', 'arg1.hidden', 'arg1.fields[0].validate']);
  });

  it('carries a data CLASS (static fields) as the object of its statics — the repo writes collections that way', () => {
    class Currencies { static readonly slug = 'finance-currencies'; static readonly fields = [{ name: 'code' }]; static helper() { return 1; } }
    const dropped: string[] = [];
    expect(PluginGuestRemote.portable([Currencies], dropped)).toEqual([{ slug: 'finance-currencies', fields: [{ name: 'code' }] }]);
    expect(dropped).toEqual(['arg0.helper']);
  });

  it('flattens a reactor Enum to its value', () => {
    class FakeEnum { constructor(readonly value: string) {} }
    expect(PluginGuestRemote.portable([{ role: new FakeEnum('measure') }])).toEqual([{ role: 'measure' }]);
  });
});
