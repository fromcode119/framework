import { AdminBootstrapRateLimitUtils } from '../src/utils/admin-bootstrap-rate-limit-utils';

describe('AdminBootstrapRateLimitUtils', () => {
  it('bypasses read-only admin initialization status requests', () => {
    expect(AdminBootstrapRateLimitUtils.shouldBypass({
      method: 'GET',
      headers: {
        'x-framework-client': 'admin-ui',
      },
      path: '/v1/auth/status',
    })).toBe(true);
  });

  it('bypasses read-only admin integration bootstrap requests', () => {
    expect(AdminBootstrapRateLimitUtils.shouldBypass({
      method: 'GET',
      headers: {
        'x-framework-client': 'admin-ui',
      },
      path: '/v1/system/admin/integrations/ai',
    })).toBe(true);
  });

  it('bypasses read-only forge assistant bootstrap requests', () => {
    expect(AdminBootstrapRateLimitUtils.shouldBypass({
      method: 'HEAD',
      headers: {
        'x-framework-client': 'admin-ui',
      },
      path: '/v1/forge/admin/assistant/tools',
    })).toBe(true);
  });

  it('does not bypass write requests', () => {
    expect(AdminBootstrapRateLimitUtils.shouldBypass({
      method: 'POST',
      headers: {
        'x-framework-client': 'admin-ui',
      },
      path: '/v1/system/admin/integrations/ai',
    })).toBe(false);
  });

  it('does not bypass frontend auth status checks', () => {
    expect(AdminBootstrapRateLimitUtils.shouldBypass({
      method: 'GET',
      headers: {
        'x-framework-client': 'frontend-ui',
      },
      path: '/v1/auth/status',
    })).toBe(false);
  });
});
