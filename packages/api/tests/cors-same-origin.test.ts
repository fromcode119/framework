import { describe, expect, it } from 'vitest';
import { ServerCorsSetup } from '@api/server/server-cors-setup';

/**
 * A request from a page on the very host it was sent to is same-origin and needs no CORS grant.
 *
 * This is decided BEFORE the allow-list, because the allow-list answers a different question — which
 * OTHER origins may call us with credentials — and by omission it was also the only thing letting an
 * app call ITSELF. With no `admin_url`/`frontend_url` saved and no env, that list is empty, which is
 * exactly the state a deployment configured entirely from the admin starts in: the console could not
 * POST to its own host.
 *
 * It is not a relaxation: a browser sets `Origin` from the initiating page and a cross-site page
 * cannot forge it, so Origin's host equalling the request's host means the caller WAS that host.
 */
describe('ServerCorsSetup same-origin', () => {
  const isSameOrigin = (origin: string, headers: Record<string, string>): boolean =>
    (ServerCorsSetup as any).isSameOrigin(origin, { headers });

  it('accepts a page calling the host it was served from', () => {
    expect(isSameOrigin('http://admin.framework.local', { host: 'admin.framework.local' })).toBe(true);
    expect(isSameOrigin('https://console.example.com', { host: 'console.example.com' })).toBe(true);
  });

  it('reads the PUBLIC host behind a proxy, which is what the request was really sent to', () => {
    // Behind the gateway the api sees `Host: api:3000`; the browser's origin is the public host.
    expect(isSameOrigin('https://console.example.com', {
      host: 'api:3000',
      'x-forwarded-host': 'console.example.com',
    })).toBe(true);

    // A chain appends, so the first value is what the client asked for.
    expect(isSameOrigin('https://console.example.com', {
      host: 'api:3000',
      'x-forwarded-host': 'console.example.com, internal.gateway',
    })).toBe(true);
  });

  it('REFUSES a different origin, which is the whole point', () => {
    expect(isSameOrigin('https://evil.test', { host: 'console.example.com' })).toBe(false);
    expect(isSameOrigin('https://evil.test', { host: 'api:3000', 'x-forwarded-host': 'console.example.com' })).toBe(false);
    // A subdomain is a different origin, and so is a different scheme's default port.
    expect(isSameOrigin('https://evil.console.example.com', { host: 'console.example.com' })).toBe(false);
    expect(isSameOrigin('http://console.example.com:8080', { host: 'console.example.com' })).toBe(false);
  });

  it('refuses anything it cannot read as an origin, rather than guessing', () => {
    expect(isSameOrigin('not-a-url', { host: 'console.example.com' })).toBe(false);
    expect(isSameOrigin('', { host: 'console.example.com' })).toBe(false);
    expect(isSameOrigin('https://console.example.com', {})).toBe(false);
  });
});
