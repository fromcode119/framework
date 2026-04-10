import { AdminBootstrapRateLimitUtils } from '../src/utils/admin-bootstrap-rate-limit-utils';

describe('AdminBootstrapRateLimitUtils', () => {
  it('uses a dedicated key for read-only admin initialization status requests', () => {
    expect(AdminBootstrapRateLimitUtils.resolveKey({
      ip: '127.0.0.1',
      method: 'GET',
      headers: {
        'x-framework-client': 'admin-ui',
      },
      path: '/v1/auth/status',
    })).toBe('admin-bootstrap:127.0.0.1:auth-status');
  });

  it('uses a dedicated key for read-only admin integration bootstrap requests', () => {
    expect(AdminBootstrapRateLimitUtils.resolveKey({
      ip: '127.0.0.1',
      method: 'GET',
      headers: {
        'x-framework-client': 'admin-ui',
      },
      path: '/v1/system/admin/integrations/ai',
    })).toBe('admin-bootstrap:127.0.0.1:system-integrations');
  });

  it('uses a generic bucket for extension admin bootstrap routes', () => {
    expect(AdminBootstrapRateLimitUtils.resolveKey({
      ip: '127.0.0.1',
      method: 'HEAD',
      headers: {
        'x-framework-client': 'admin-ui',
      },
      path: '/v1/forge/admin/assistant/tools',
    })).toBe('admin-bootstrap:127.0.0.1:extension-admin');
  });

  it('keeps write requests on the default bucket', () => {
    expect(AdminBootstrapRateLimitUtils.resolveKey({
      ip: '127.0.0.1',
      method: 'POST',
      headers: {
        'x-framework-client': 'admin-ui',
      },
      path: '/v1/system/admin/integrations/ai',
    })).toBe('ip:127.0.0.1');
  });

  it('keeps frontend auth status checks on the default bucket', () => {
    expect(AdminBootstrapRateLimitUtils.resolveKey({
      ip: '127.0.0.1',
      method: 'GET',
      headers: {
        'x-framework-client': 'frontend-ui',
      },
      path: '/v1/auth/status',
    })).toBe('ip:127.0.0.1');
  });
});
