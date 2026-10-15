import { describe, expect, it } from 'vitest';
import { RequestSurfaceUtils } from '@fromcode119/core';

/**
 * An app a site serves calls the site's own address, so by address alone it looks like the website.
 * It says what it is in the client header, and a website-only switch then leaves it alone.
 */
describe('a request from an app', () => {
  it('is not the website, even on a website page address', () => {
    expect(RequestSurfaceUtils.isFrontendRequestContext({ headers: { 'x-framework-client': 'app' }, path: '/login' })).toBe(false);
  });

  it('leaves the website as it was', () => {
    expect(RequestSurfaceUtils.isFrontendRequestContext({ headers: { 'x-framework-client': 'frontend-ui' } })).toBe(true);
    expect(RequestSurfaceUtils.isFrontendRequestContext({ headers: {}, path: '/login' })).toBe(true);
  });
});
