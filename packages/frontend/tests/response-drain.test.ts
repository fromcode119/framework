import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResponseDrain } from '@/lib/server-api/response-drain';
import { SiteVisibilityProxyGuard } from '@/lib/document/site-visibility-proxy-guard';

/** A response nobody reads is released, so a long-lived storefront process does not hold its connection. */
describe('ResponseDrain', () => {
  afterEach(() => vi.restoreAllMocks());

  const openBody = (onCancel: () => void, status: number) => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{}')); },
    cancel: onCancel,
  }), { status });

  it('never waits on the cancel — a teed body (Next keeps one for its cache) does not resolve it', () => {
    const [branch] = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{}')); } }).tee();
    // Returns at once: nothing to await, so a render that skipped this response carries on.
    expect(ResponseDrain.discard(new Response(branch, { status: 404 }))).toBeUndefined();
  });

  it('cancels the body of a response it is handed, and tolerates none', async () => {
    const cancel = vi.fn();
    ResponseDrain.discard(openBody(cancel, 404));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => ResponseDrain.discard(null)).not.toThrow();
  });

  it('the site-visibility check releases a 503 it does not read, and still lets the visitor in', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(openBody(cancel, 503)));
    expect(await SiteVisibilityProxyGuard.isReadable(`drain-${Date.now()}.test`, 'http://api', '')).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
