import { describe, expect, it } from 'vitest';
import { RequestSurfaceUtils } from './request-surface-utils';

describe('RequestSurfaceUtils', () => {
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
      headers: { origin: 'http://admin.framework.local', referer: 'http://admin.framework.local/ecommerce/customers' },
      url: '/api/v1/plugins/ecommerce/orders?limit=200',
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
      headers: { origin: 'http://www.framework.local', referer: 'http://www.framework.local/account' },
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
  });

  it('does not treat auth api routes as frontend paths without a frontend signal', () => {
    expect(RequestSurfaceUtils.isFrontendPath('/api/v1/auth/login')).toBe(false);
    expect(RequestSurfaceUtils.isAdminPath('/api/v1/auth/login')).toBe(false);
    expect(RequestSurfaceUtils.isApiPath('/api/v1/auth/login')).toBe(true);
  });
});