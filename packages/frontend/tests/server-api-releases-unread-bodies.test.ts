import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerApiUtils } from '@/lib/server-api/server-api';

/**
 * A response the fallback loop moves past is never read. Unread, its body keeps the connection to
 * the api checked out until garbage collection — so every 404 or 5xx skipped held a socket.
 */
describe('ServerApiUtils releases the api responses it does not read', () => {
  const originalEnv = { ...process.env };
  let cancelled: string[];

  // A body meant to be read closes; one that should be released stays open, so a cancel is seen.
  const reply = (label: string, status: number, body: string, read = false) => {
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode(body)); if (read) controller.close(); },
      cancel() { cancelled.push(label); },
    });
    return new Response(stream, { status, headers: { 'content-type': 'application/json' } });
  };

  beforeEach(() => {
    cancelled = [];
    process.env.INTERNAL_API_URL = 'http://api-a:3000';
    process.env.API_URL = 'http://api-b:3000';
    vi.spyOn(ServerApiUtils, 'buildForwardedAuthHeaders').mockResolvedValue(new Headers());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('releases a 5xx it moved past, and returns the next prefix\'s answer', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply('first-503', 503, '{}'))
      .mockResolvedValueOnce(reply('second-200', 200, '{"ok":true}', true));
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await ServerApiUtils.serverFetchJsonOutcome('/system/frontend');

    expect(outcome.value).toEqual({ ok: true });
    expect(cancelled).toEqual(['first-503']);
  });

  it('releases every non-OK response except the one it hands back', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(reply('first-404', 404, '{}'))
      .mockResolvedValueOnce(reply('second-404', 404, '{"kept":true}', true));
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await ServerApiUtils.serverFetchResponseOutcome('/system/resolve');

    expect(outcome.value?.status).toBe(404);
    expect(await outcome.value?.json()).toEqual({ kept: true });
    expect(cancelled).toEqual(['first-404']);
  });
});
