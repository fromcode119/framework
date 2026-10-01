// @vitest-environment jsdom
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrontendAuthRequestHeaders } from '@/lib/frontend-auth-request-headers';
import { FrontendTokenRedemption } from '@/lib/frontend-token-redemption';

/**
 * The api refuses a cookie-carrying write that does not echo the `fc_csrf` cookie in `X-CSRF-Token`.
 * The default register, verification and password pages posted without it, so every one of them was
 * answered 403 on a site that uses them.
 */
const PAGES = [
  'register/components/view/register-client.client.tsx',
  'forgot-password/components/view/forgot-password-client.client.tsx',
  'reset-password/components/view/reset-password-client.client.tsx',
  'verify-email/components/view/verify-email-client.client.tsx',
  'verify-email-change/components/view/verify-email-change-client.client.tsx',
];

describe('the default auth pages send the CSRF token', () => {
  afterEach(() => { document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; });

  it('echoes the fc_csrf cookie in X-CSRF-Token', () => {
    document.cookie = 'fc_csrf=abc123; path=/';
    expect(FrontendAuthRequestHeaders.json()).toEqual({
      'Content-Type': 'application/json',
      'X-Framework-Client': 'frontend-ui',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': 'abc123',
    });
    expect(FrontendAuthRequestHeaders.json({ 'X-Reset-Context': 'frontend' })['X-Reset-Context']).toBe('frontend');
  });

  it('every default auth page posts with those headers, never a hand-written set', () => {
    for (const page of PAGES) {
      const source = readFileSync(join(__dirname, '..', 'app', page), 'utf8');
      expect(source, page).toMatch(/FrontendAuthRequestHeaders\.json\(|FrontendTokenRedemption\.redeem\(/);
      expect(source, page).not.toContain("'X-Requested-With'");
    }
  });
});

describe('a one-time link token is redeemed once per page load', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('a page that mounts twice shares the first request instead of posting the used token again', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const [first, second] = await Promise.all([
      FrontendTokenRedemption.redeem('/api/v1/auth/verify-email', 'tok-1'),
      FrontendTokenRedemption.redeem('/api/v1/auth/verify-email', 'tok-1'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ ok: true, payload: { success: true } });
    expect(second).toBe(first);
    expect(await FrontendTokenRedemption.redeem('/api/v1/auth/verify-email', 'tok-1')).toBe(first);
  });

  it('a refused attempt can be tried again', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid verification token' }), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await FrontendTokenRedemption.redeem('/api/v1/auth/verify-email', 'tok-2')).ok).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await FrontendTokenRedemption.redeem('/api/v1/auth/verify-email', 'tok-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
