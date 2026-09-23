import { describe, expect, it } from 'vitest';
import { PluginHostPortableView } from '@core/plugin/host/plugin-host-portable-view';

class CourierClientFixture {
  readonly config = { username: 'fromcode@gmail.com', baseUrl: 'https://courier.example.com/services' };
  async requestByKey(): Promise<string> { return 'offices'; }
  async request(): Promise<string> { return 'raw'; }
}

describe('PluginHostPortableView', () => {
  it('names the methods of an integration client instead of dropping them', () => {
    const view = PluginHostPortableView.of(new CourierClientFixture(), 'delta-shipping') as any;
    const marker = view[PluginHostPortableView.MARKER];
    expect(marker.methods.sort()).toEqual(['request', 'requestByKey']);
    expect(marker.path).toEqual([]);
    expect(marker.data.config.username).toBe('fromcode@gmail.com');
  });

  it('records the path of a client nested inside a plain result', () => {
    const view = PluginHostPortableView.of({ instance: new CourierClientFixture(), resolved: { config: { language: 'bg' } } }, 'delta-shipping') as any;
    expect(view.instance[PluginHostPortableView.MARKER].path).toEqual(['instance']);
    expect(view.resolved.config.language).toBe('bg');
  });

  it('names the methods of a client built as an object literal, not a class', () => {
    // How a courier client is actually built: a literal whose calls are arrow properties.
    const client = { provider: 'courier', config: { language: 'bg' }, request: async () => 'ok', requestByKey: async () => 'ok' };
    const view = PluginHostPortableView.of(client, 'delta-shipping') as any;
    expect(view[PluginHostPortableView.MARKER].methods.sort()).toEqual(['request', 'requestByKey']);
    expect(view[PluginHostPortableView.MARKER].data.provider).toBe('courier');
  });

  it('leaves plain data and built-ins exactly as they were', () => {
    const when = new Date('2026-09-06T00:00:00.000Z');
    const rows = [{ id: 1, name: 'София' }, { id: 2, name: 'Пловдив' }];
    expect(PluginHostPortableView.of(rows, 'delta-shipping')).toBe(rows);
    expect(PluginHostPortableView.of(when, 'delta-shipping')).toBe(when);
    expect(PluginHostPortableView.of('courier', 'delta-shipping')).toBe('courier');
    expect(PluginHostPortableView.of(null, 'delta-shipping')).toBeNull();
  });

  it('never turns a serialization hook into a remote call', () => {
    class WithHooks { async then(): Promise<void> {} async toJSON(): Promise<void> {} async ping(): Promise<void> {} }
    const view = PluginHostPortableView.of(new WithHooks(), 'delta-shipping') as any;
    expect(view[PluginHostPortableView.MARKER].methods).toEqual(['ping']);
  });
});

describe('PluginHostPortableView and a guest\'s own callbacks', () => {
  it('sends a stand-in home as its id rather than as a callable method', () => {
    const standIn = () => Promise.resolve('via host');
    Object.defineProperty(standIn, '$fcCallbackId', { value: 'callback:7', enumerable: false });
    const view = PluginHostPortableView.of({ provider: 'courier', request: standIn }) as any;
    expect(view.request).toEqual({ $fcCallback: 'callback:7' });
    expect(view[PluginHostPortableView.MARKER]).toBeUndefined();
    expect(view.provider).toBe('courier');
  });
});
