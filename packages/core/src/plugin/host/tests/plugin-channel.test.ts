import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'events';
import { PluginChannel } from '@core/plugin/host/plugin-channel';

/** Two channels joined back to back, the way a host and its guest are over IPC. */
function pair(): { a: PluginChannel; b: PluginChannel; emitterA: EventEmitter; emitterB: EventEmitter } {
  const emitterA = new EventEmitter();
  const emitterB = new EventEmitter();
  const a = new PluginChannel({ send: (m) => setImmediate(() => emitterB.emit('message', m)), on: (e, l) => emitterA.on(e, l) });
  const b = new PluginChannel({ send: (m) => setImmediate(() => emitterA.emit('message', m)), on: (e, l) => emitterB.on(e, l) });
  return { a, b, emitterA, emitterB };
}

describe('PluginChannel', () => {
  it('answers a request with the handler result, correlated by id', async () => {
    const { a, b } = pair();
    b.serve(async (type, payload) => `${type}:${(payload as any).n}`);
    const [x, y] = await Promise.all([a.request('t', { n: 1 }), a.request('t', { n: 2 })]);
    expect(x).toBe('t:1');
    expect(y).toBe('t:2');
  });

  it('carries a thrown error across as an Error with its code and status', async () => {
    const { a, b } = pair();
    b.serve(async () => { throw Object.assign(new Error('nope'), { code: 'unknown_invocation', statusCode: 403 }); });
    await expect(a.request('t', {})).rejects.toMatchObject({ message: 'nope', code: 'unknown_invocation', statusCode: 403 });
  });

  it('times out a request the peer never answers', async () => {
    const { a, b } = pair();
    b.serve(() => new Promise(() => undefined));
    await expect(a.request('t', {}, 30)).rejects.toThrow(/timed out/);
  });

  it('rejects everything outstanding when the channel closes — a dead guest fails callers at once', async () => {
    const { a, b } = pair();
    b.serve(() => new Promise(() => undefined));
    const waiting = a.request('t', {});
    a.close(new Error('guest exited'));
    await expect(waiting).rejects.toThrow('guest exited');
    await expect(a.request('t', {})).rejects.toThrow('channel closed');
  });

  it('delivers notifications without a reply', async () => {
    const { a, b } = pair();
    const seen: unknown[] = [];
    b.onNotify((type, payload) => seen.push([type, payload]));
    a.notify('log', { level: 'info' });
    await new Promise((r) => setImmediate(r));
    expect(seen).toEqual([['log', { level: 'info' }]]);
  });
});
