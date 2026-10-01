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

  it('cancels the body of a response it is handed, and tolerates none', async () => {
    const cancel = vi.fn();
    await ResponseDrain.discard(openBody(cancel, 404));
    expect(cancel).toHaveBeenCalledTimes(1);
    await expect(ResponseDrain.discard(null)).resolves.toBeUndefined();
  });

  it('the site-visibility check releases a 503 it does not read, and still lets the visitor in', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(openBody(cancel, 503)));
    expect(await SiteVisibilityProxyGuard.isReadable(`drain-${Date.now()}.test`, 'http://api', '')).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
