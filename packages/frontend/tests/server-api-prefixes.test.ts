import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ServerApiUtils } from '@/lib/server-api';
import { ServerFetchOutcome } from '@/lib/server-fetch-outcome';
import { ServerApiUnreachableError } from '@/lib/server-api-unreachable-error';

/**
 * Guards the root cause of the intermittent hard 404s on published pages: the BROWSER-facing
 * `NEXT_PUBLIC_API_URL` was being used as a server-side fetch fallback. Inside a container that
 * hostname does not resolve, so every attempt burned the full DNS timeout AND saturated the
 * container resolver — after which the healthy server-side base failed to resolve too, the page
 * resolver returned null, and the route answered 404 for a page that exists.
 */
describe('ServerApiUtils.getServerApiPrefixes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.INTERNAL_API_URL;
    delete process.env.API_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.FRONTEND_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('excludes the browser-facing NEXT_PUBLIC_API_URL when a server-side base is configured', () => {
    process.env.API_URL = 'http://api:3000';
    process.env.NEXT_PUBLIC_API_URL = 'http://api.framework.local';

    const prefixes = ServerApiUtils.getServerApiPrefixes();

    expect(prefixes.some((prefix) => prefix.startsWith('http://api:3000'))).toBe(true);
    expect(prefixes.some((prefix) => prefix.includes('api.framework.local'))).toBe(false);
  });

  it('prefers INTERNAL_API_URL ahead of API_URL', () => {
    process.env.INTERNAL_API_URL = 'http://api-internal:3000';
    process.env.API_URL = 'http://api:3000';

    const prefixes = ServerApiUtils.getServerApiPrefixes();

    expect(prefixes[0].startsWith('http://api-internal:3000')).toBe(true);
  });

  it('still falls back to the public URL when nothing server-side is configured', () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://api.framework.local';

    const prefixes = ServerApiUtils.getServerApiPrefixes();

    expect(prefixes.some((prefix) => prefix.includes('api.framework.local'))).toBe(true);
  });
});

/**
 * A 429/5xx from the API says nothing about whether the document exists. Reading it as "absent"
 * is how a rate-limited SSR container turned every published page into a hard 404 — all
 * server-side traffic shares one source IP, so a per-IP limiter throttles the whole storefront.
 */
describe('ServerApiUtils status classification', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.API_URL = 'http://api:3000';
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  it('treats a 429 as unreachable, not as "no such document"', async () => {
    globalThis.fetch = (async () => new Response('rate limited', { status: 429 })) as typeof fetch;

    const outcome = await ServerApiUtils.serverFetchJsonOutcome('/system/resolve?slug=shop/question');

    expect(outcome.isUnreachable).toBe(true);
    expect(() => outcome.valueOrThrow('/system/resolve')).toThrow(ServerApiUnreachableError);
  });

  it('treats a 503 response fetch as unreachable', async () => {
    globalThis.fetch = (async () => new Response('down', { status: 503 })) as typeof fetch;

    const outcome = await ServerApiUtils.serverFetchResponseOutcome('/system/resolve?slug=shop/question');

    expect(outcome.isUnreachable).toBe(true);
  });

  it('treats a genuine 404 as an answer meaning the document is absent', async () => {
    globalThis.fetch = (async () => new Response('nope', { status: 404 })) as typeof fetch;

    const outcome = await ServerApiUtils.serverFetchJsonOutcome('/system/resolve?slug=nope');

    expect(outcome.isUnreachable).toBe(false);
    expect(outcome.valueOrThrow('/system/resolve')).toBeNull();
  });
});

describe('ServerFetchOutcome', () => {
  it('keeps "no such document" and "unreachable" apart', () => {
    const missing = ServerFetchOutcome.resolved<string>(null);
    const unreachable = ServerFetchOutcome.unreachable<string>(new TypeError('fetch failed'));

    expect(missing.isUnreachable).toBe(false);
    expect(unreachable.isUnreachable).toBe(true);
    // Both carry a null value — which is exactly why the bare `null` return was ambiguous.
    expect(missing.value).toBeNull();
    expect(unreachable.value).toBeNull();
  });

  it('returns null for a genuine miss but throws when the API was unreachable', () => {
    expect(ServerFetchOutcome.resolved<string>(null).valueOrThrow('/system/resolve')).toBeNull();
    expect(() => ServerFetchOutcome.unreachable<string>(new TypeError('fetch failed')).valueOrThrow('/system/resolve'))
      .toThrow(ServerApiUnreachableError);
  });
});
