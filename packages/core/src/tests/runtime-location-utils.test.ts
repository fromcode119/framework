import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuntimeLocationUtils } from '@core/utils/runtime-location-utils';

/** Runs `body` with the admin URL declared, restoring whatever was there. */
const withAdminUrl = (url: string, body: () => void): void => {
  const adminUrl = process.env.ADMIN_URL;
  const publicBasePath = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH;
  process.env.ADMIN_URL = url;
  process.env.NEXT_PUBLIC_ADMIN_BASE_PATH = '';
  try {
    body();
  } finally {
    process.env.ADMIN_URL = adminUrl;
    process.env.NEXT_PUBLIC_ADMIN_BASE_PATH = publicBasePath;
  }
};

describe('RuntimeLocationUtils', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefixes admin paths with the configured admin base path', () => {
    expect(RuntimeLocationUtils.prefixBasePath('/tracker', '/control/admin')).toBe('/control/admin/tracker');
  });

  it('does not double-prefix admin paths that already include the admin base path', () => {
    expect(RuntimeLocationUtils.prefixBasePath('/control/admin/tracker', '/control/admin')).toBe('/control/admin/tracker');
  });

  /**
   * The mount is DECLARED. This used to be found by searching the pathname for the literal segment
   * `admin`, so a console could only live somewhere containing that exact word and any other prefix
   * built links that pointed nowhere. The prefix is now whatever the deployment configured.
   */
  it('uses the configured mount when the page is served under it', () => {
    // `EnvUtils.isServer()` keys off `document`, not `window` — stubbing only `window` left these
    // browser-path helpers on their SERVER branch, so the assertions could never hold.
    withAdminUrl('https://example.test/control/admin', () => {
      vi.stubGlobal('document', {});
      vi.stubGlobal('window', {
        location: { href: 'https://example.test/control/admin/consent/banner' },
      });

      expect(RuntimeLocationUtils.toAdminPath('/consent')).toBe('/control/admin/consent');
    });
  });

  /** The proof the word is gone: a mount that contains no "admin" anywhere works the same. */
  it('works for a mount that has nothing to do with the word "admin"', () => {
    withAdminUrl('https://example.test/juja', () => {
      vi.stubGlobal('document', {});
      vi.stubGlobal('window', {
        location: { href: 'https://example.test/juja/consent/banner' },
      });

      expect(RuntimeLocationUtils.toAdminPath('/consent')).toBe('/juja/consent');
    });
  });

  /**
   * A console on a host of its own is served at the ROOT, so its links must carry no prefix even
   * though one is configured. Prefixing them would break every link on that host.
   */
  it('adds no prefix when the console is served at the root of its own host', () => {
    withAdminUrl('https://example.test/juja', () => {
      vi.stubGlobal('document', {});
      vi.stubGlobal('window', {
        location: { href: 'https://console.example.test/consent/banner' },
      });

      expect(RuntimeLocationUtils.toAdminPath('/consent')).toBe('/consent');
    });
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

    expect(RuntimeLocationUtils.toAdminPath('/consent')).toBe('/dashboard/admin/consent');

    process.env.ADMIN_URL = originalAdminUrl;
    process.env.NEXT_PUBLIC_ADMIN_BASE_PATH = originalNextPublicAdminBasePath;
  });
});