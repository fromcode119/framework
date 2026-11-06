import { afterEach, describe, expect, it, vi } from 'vitest';
import { StorefrontMissRedirect } from '@/lib/storefront-miss-redirect';
import { MissedResolutionFetch } from '@/lib/missed-resolution-fetch';

/**
 * A path the framework answers itself (sign-in, registration) is no miss. Its redirect check must not
 * make a second, miss-reporting lookup: that logged every visit to /login as a 404, moved the site's
 * content revision and kept the page out of the document cache.
 */
describe('StorefrontMissRedirect.afterMiss for a path that is not a miss', () => {
  afterEach(() => vi.restoreAllMocks());

  it('answers from the lookup already made and reports nothing', async () => {
    const fetch = vi.spyOn(MissedResolutionFetch, 'fetch');
    const rule = { target: '/sign-in', permanent: true, gone: false };
    expect(await StorefrontMissRedirect.afterMiss('login', { type: 'redirect', plugin: '', doc: null, canonicalPath: '', redirect: rule }, false)).toEqual(rule);
    expect(await StorefrontMissRedirect.afterMiss('login', null, false)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('still asks once, as the last word, for a real miss', async () => {
    const fetch = vi.spyOn(MissedResolutionFetch, 'fetch').mockResolvedValue(null as any);
    await StorefrontMissRedirect.afterMiss('nothing-here', null);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
