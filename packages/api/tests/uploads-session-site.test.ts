import { describe, expect, it, vi } from 'vitest';
import { UploadsSessionSite } from '@api/server/uploads-session-site';

/**
 * The console serves every site from one host, so an image request there says whose file it is only
 * through the admin's session. The token is verified, and a bad one names no site.
 */
const req = (cookie?: string): any => ({ headers: cookie ? { cookie } : {} });

describe('UploadsSessionSite', () => {
  it('names the site of a verified admin session, and asks once per token', async () => {
    const verify = vi.fn(async () => ({ tenantId: 'thinkinpink' }));
    const sessions = new UploadsSessionSite(verify);

    expect(await sessions.siteFor(req('theme=dark; fc_token=abc.def; other=1'))).toBe('thinkinpink');
    expect(await sessions.siteFor(req('fc_token=abc.def'))).toBe('thinkinpink');
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith('abc.def');
  });

  it('names no site for a token that does not verify, or no admin cookie at all', async () => {
    const sessions = new UploadsSessionSite(async () => { throw new Error('Invalid or expired token'); });

    expect(await sessions.siteFor(req('fc_token=forged'))).toBeNull();
    expect(await sessions.siteFor(req('userToken=storefront'))).toBeNull();
    expect(await sessions.siteFor(req())).toBeNull();
  });

  it('names no site for the platform scope', async () => {
    const sessions = new UploadsSessionSite(async () => ({}));
    expect(await sessions.siteFor(req('fc_token=platform'))).toBeNull();
  });
});
