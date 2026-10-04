import { describe, expect, it, vi } from 'vitest';
import { PluginGuestFetch } from '@core/plugin/host/plugin-guest-fetch';

/**
 * An isolated plugin's `context.fetch` options cross to the host as data. A timeout signal used to
 * cross too, arrived as `{}`, and the host's fetch refused every such request — so any plugin that set
 * a timeout (exchange-rate sync, form delivery, webhooks) could never reach the network.
 */
const reply = { status: 200, statusText: 'OK', headers: { 'content-type': 'text/plain' }, body: Buffer.from('ok') };
const guest = (call: (...args: any[]) => Promise<unknown>) => {
  const remote = { call: vi.fn(call) };
  return { fetch: new PluginGuestFetch(remote as any), remote };
};

describe('isolated plugin context.fetch', () => {
  it('never sends the signal to the host, and sends headers as a plain object', async () => {
    const { fetch, remote } = guest(async () => reply);
    const response = await fetch.fetch('https://example.com', {
      signal: new AbortController().signal,
      headers: new Headers({ Accept: 'application/json' }),
      body: { a: 1 },
    });
    expect(await response.text()).toBe('ok');
    const sent = remote.call.mock.calls[0][1][0].args[1];
    expect(sent).not.toHaveProperty('signal');
    expect(sent.headers).toEqual({ accept: 'application/json' });
    expect(sent.body).toBe('{"a":1}');
  });

  it('rejects with the signal\'s reason when it aborts first, as fetch does', async () => {
    const { fetch } = guest(() => new Promise(() => undefined));
    await expect(fetch.fetch('https://example.com', { signal: AbortSignal.timeout(10) })).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('does not call the host for an already-aborted signal', async () => {
    const { fetch, remote } = guest(async () => reply);
    const controller = new AbortController();
    controller.abort();
    await expect(fetch.fetch('https://example.com', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(remote.call).not.toHaveBeenCalled();
  });

  it('passes the host\'s error through unchanged', async () => {
    const { fetch } = guest(async () => { throw new Error('host refused'); });
    await expect(fetch.fetch('https://example.com', { signal: new AbortController().signal })).rejects.toThrow('host refused');
  });
});
