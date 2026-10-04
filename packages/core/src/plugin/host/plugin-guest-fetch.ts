import type { PluginGuestRemote } from '@core/plugin/host/plugin-guest-remote';

/**
 * An isolated plugin's `context.fetch`. The host performs the request and the body comes back as
 * bytes, so the options cross a process boundary and must be plain data.
 *
 * Two parts of a `RequestInit` are live objects that do not survive that crossing, and both used to be
 * sent anyway: an `AbortSignal` arrived on the host as `{}` and the host's fetch refused the whole
 * request ("Expected signal to be an instance of AbortSignal") — every call that set a timeout failed,
 * whatever the network did. A `Headers` instance arrived empty. The signal now stays in the plugin's
 * process and rejects the call the way a fetch does when it aborts; headers cross as a plain object.
 */
export class PluginGuestFetch {
  constructor(private readonly remote: PluginGuestRemote) {}

  async fetch(url: string, init?: Record<string, unknown>): Promise<Response> {
    const signal = init?.signal as AbortSignal | null | undefined;
    signal?.throwIfAborted();
    const call = this.remote.call('context', [{ name: 'fetch', args: [url, PluginGuestFetch.wire(init)] }]);
    const reply = (await (signal ? PluginGuestFetch.until(call, signal) : call)) as {
      status: number; statusText: string; headers: Record<string, string>; body: Buffer;
    };
    return new Response(new Uint8Array(reply.body), { status: reply.status, statusText: reply.statusText, headers: reply.headers });
  }

  /** The options as plain data: no signal, headers as an object, a non-string body as JSON. */
  static wire(init?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!init) return undefined;
    const { signal: _signal, ...rest } = init;
    if (rest.headers instanceof Headers) rest.headers = Object.fromEntries(rest.headers.entries());
    if (rest.body !== undefined && typeof rest.body !== 'string' && !Buffer.isBuffer(rest.body)) rest.body = JSON.stringify(rest.body);
    return rest;
  }

  /** Settles with the call, or rejects with the signal's reason the moment it aborts — as fetch does. */
  private static until<T>(call: Promise<T>, signal: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
      call.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
  }
}
