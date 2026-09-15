import { describe, expect, it } from 'vitest';
import { RequestSurfaceUtils } from '@core/utils/request-surface-utils';

describe('RequestSurfaceUtils', () => {
  it('tells extension assets from admin pages under the same root', () => {
    expect(RequestSurfaceUtils.isExtensionAssetPath('/plugins/zeta/ui/bundle.js')).toBe(true);
    expect(RequestSurfaceUtils.isExtensionAssetPath('/api/v1/plugins/zeta/ui/style.css')).toBe(true);
    expect(RequestSurfaceUtils.isExtensionAssetPath('/themes/atlantis/public/logo.svg')).toBe(true);
    expect(RequestSurfaceUtils.isExtensionAssetPath('/plugins/chi/settings')).toBe(false);
    expect(RequestSurfaceUtils.isExtensionAssetPath('/plugins/installed')).toBe(false);
    expect(RequestSurfaceUtils.isExtensionAssetPath('/plugins/zeta/ui')).toBe(false);
    expect(RequestSurfaceUtils.isExtensionAssetPath('/media')).toBe(false);
  });

  it('on an admin host only the api, uploads and extension assets are api paths', () => {
    expect(RequestSurfaceUtils.isApiPathOnAppHost('/api/v1/auth/host')).toBe(true);
    expect(RequestSurfaceUtils.isApiPathOnAppHost('/uploads/a.png')).toBe(true);
    expect(RequestSurfaceUtils.isApiPathOnAppHost('/plugins/zeta/ui/bundle.js')).toBe(true);
    expect(RequestSurfaceUtils.isApiPathOnAppHost('/media')).toBe(false);
    expect(RequestSurfaceUtils.isApiPathOnAppHost('/plugins/chi/settings')).toBe(false);
    expect(RequestSurfaceUtils.isApiPath('/plugins/chi/settings')).toBe(true);
  });

  it('classifies admin requests from the framework client header', () => {
    expect(RequestSurfaceUtils.isAdminRequestContext({
      headers: { 'x-framework-client': 'admin-ui' },
      url: '/api/v1/auth/login',
    })).toBe(true);
  });

  it('classifies frontend requests from the framework client header', () => {
    expect(RequestSurfaceUtils.isFrontendRequestContext({
      headers: { 'x-framework-client': 'frontend-ui' },
      url: '/api/v1/auth/login',
    })).toBe(true);
  });

  it('detects admin auth requests from same-host admin referers', () => {
    expect(RequestSurfaceUtils.isAdminRequestContext({
      headers: { referer: 'https://domain.com/admin/login?next=%2Fadmin' },
      url: '/api/v1/auth/login',
    })).toBe(true);
  });

  it('detects admin requests from admin subdomain origins', () => {
    expect(RequestSurfaceUtils.isAdminRequestContext({
      headers: { origin: 'https://admin.example.test', referer: 'https://admin.example.test/alpha/customers' },
      url: '/api/v1/plugins/alpha/orders?limit=200',
    })).toBe(true);
  });

  it('detects frontend auth requests from same-host frontend referers', () => {
    expect(RequestSurfaceUtils.isFrontendRequestContext({
      headers: { referer: 'https://domain.com/account/security' },
      url: '/api/v1/auth/status',
    })).toBe(true);
  });

  it('does not classify frontend subdomain requests as admin requests', () => {
    expect(RequestSurfaceUtils.isAdminRequestContext({
      headers: { origin: 'https://www.example.test', referer: 'https://www.example.test/account' },
      url: '/api/v1/system/events',
    })).toBe(false);
  });

  it('treats versioned system admin routes as admin api paths', () => {
    expect(RequestSurfaceUtils.isAdminPath('/api/v1/system/admin/users')).toBe(true);
    expect(RequestSurfaceUtils.isApiPath('/api/v1/system/admin/users')).toBe(true);
  });

  it('treats extension admin routes as admin api paths', () => {
    expect(RequestSurfaceUtils.isAdminPath('/api/v1/forge/admin/assistant/models')).toBe(true);
    expect(RequestSurfaceUtils.isApiPath('/api/v1/forge/admin/assistant/models')).toBe(true);
    expect(RequestSurfaceUtils.isExtensionAdminPath('/api/v1/forge/admin/assistant/models')).toBe(true);
  });

  it('does not treat auth api routes as frontend paths without a frontend signal', () => {
    expect(RequestSurfaceUtils.isFrontendPath('/api/v1/auth/login')).toBe(false);
    expect(RequestSurfaceUtils.isAdminPath('/api/v1/auth/login')).toBe(false);
    expect(RequestSurfaceUtils.isApiPath('/api/v1/auth/login')).toBe(true);
  });
});
/**
 * A DOWNLOAD is a top-level navigation: no `origin`, no `referer`, no client header.
 *
 * Opening a generated document from the admin sent none of the three, so admin detection failed,
 * tenancy fell back to resolving the host as a SITE, and the admin's own host is not one — `404
 * unknown_host` on a document the operator was looking at the admin page for. Every download and
 * direct link in the admin had the same hole.
 */
describe('a request that arrives on the admin app is admin traffic', () => {
  const withAdminUrl = async (url: string, run: () => void) => {
    const previous = process.env.ADMIN_URL;
    process.env.ADMIN_URL = url;
    try { run(); } finally {
      if (previous === undefined) delete process.env.ADMIN_URL; else process.env.ADMIN_URL = previous;
    }
  };

  it('recognises the admin app by the address the request arrived on, with no headers to help', async () => {
    await withAdminUrl('https://admin.example.com', () => {
      expect(RequestSurfaceUtils.isAdminRequestContext({
        headers: { 'x-forwarded-host': 'admin.example.com', 'x-forwarded-proto': 'https' },
        url: '/api/v1/plugins/example/documents/303/pdf',
      })).toBe(true);
    });
  });

  it('does NOT mistake a site for the admin app', async () => {
    await withAdminUrl('https://admin.example.com', () => {
      expect(RequestSurfaceUtils.isAdminRequestContext({
        headers: { 'x-forwarded-host': 'someshop.example.com', 'x-forwarded-proto': 'https' },
        url: '/api/v1/plugins/example/documents/303/pdf',
      })).toBe(false);
    });
  });

  it('prefers the forwarded host, because behind a proxy `host` is an internal name', async () => {
    await withAdminUrl('https://admin.example.com', () => {
      expect(RequestSurfaceUtils.isAdminRequestContext({
        headers: { host: 'api:3000', 'x-forwarded-host': 'admin.example.com', 'x-forwarded-proto': 'https' },
        url: '/api/v1/plugins/example/documents/303/pdf',
      })).toBe(true);
    });
  });
});
