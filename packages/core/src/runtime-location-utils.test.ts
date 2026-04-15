import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeLocationUtils } from './runtime-location-utils';

describe('RuntimeLocationUtils', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefixes admin paths with the configured admin base path', () => {
    expect(RuntimeLocationUtils.prefixBasePath('/analytics', '/control/admin')).toBe('/control/admin/analytics');
  });

  it('does not double-prefix admin paths that already include the admin base path', () => {
    expect(RuntimeLocationUtils.prefixBasePath('/control/admin/analytics', '/control/admin')).toBe('/control/admin/analytics');
  });

  it('infers nested admin base paths from the current browser location', () => {
    vi.stubGlobal('window', {
      location: {
        href: 'https://example.test/control/admin/privacy/banner',
      },
    });

    expect(RuntimeLocationUtils.toAdminPath('/privacy')).toBe('/control/admin/privacy');
  });

  it('falls back to the configured admin base path when no admin segment is present in the current browser location', () => {
    const originalAdminUrl = process.env.ADMIN_URL;
    const originalNextPublicAdminBasePath = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH;

    process.env.ADMIN_URL = 'https://example.test/dashboard/admin';
    process.env.NEXT_PUBLIC_ADMIN_BASE_PATH = '';
    vi.stubGlobal('window', {
      location: {
        href: 'https://example.test/account',
      },
    });

    expect(RuntimeLocationUtils.toAdminPath('/privacy')).toBe('/dashboard/admin/privacy');

    process.env.ADMIN_URL = originalAdminUrl;
    process.env.NEXT_PUBLIC_ADMIN_BASE_PATH = originalNextPublicAdminBasePath;
  });
});