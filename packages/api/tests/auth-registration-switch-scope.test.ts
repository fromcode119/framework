import { describe, expect, it, vi } from 'vitest';
import { SystemConstants } from '@fromcode119/core';
import { AuthControllerLifecycle } from '@api/controllers/auth/auth-controller-lifecycle';

/**
 * The website and the apps a site serves each answer to their own switch. A site can close its website
 * and keep signing people up in its app — and no request reaches sign-up merely by saying it is not the
 * website, because which surface a request is comes from the request itself.
 */
describe('the sign-up and sign-in switches', () => {
  const META = SystemConstants.META_KEY;
  const controller = (fromWebsite: boolean, settings: Record<string, boolean>) => {
    const instance: any = Object.create(AuthControllerLifecycle.prototype);
    Object.assign(instance, {
      isFrontendRequestContext: vi.fn(() => fromWebsite),
      getSettingBoolean: vi.fn(async (key: string) => settings[key] ?? true),
    });
    return instance;
  };
  const request = (client?: string): any => ({
    headers: client ? { 'x-framework-client': client } : {},
    get(name: string) { return this.headers[name.toLowerCase()]; },
    originalUrl: '/api/v1/auth/register', url: '/api/v1/auth/register', path: '/api/v1/auth/register',
  });

  it('closes sign-up on the website when the website switch is off', async () => {
    const site = controller(true, { [META.FRONTEND_REGISTRATION_ENABLED]: false });
    expect(await site.isFrontendRegistrationEnabledForRequest(request('frontend-ui'))).toBe(false);
  });

  it('keeps sign-up open for an app when only the website switch is off', async () => {
    const app = controller(false, { [META.FRONTEND_REGISTRATION_ENABLED]: false, [META.APP_REGISTRATION_ENABLED]: true });
    expect(await app.isFrontendRegistrationEnabledForRequest(request('app'))).toBe(true);
    expect(app.getSettingBoolean).toHaveBeenCalledWith(META.APP_REGISTRATION_ENABLED, true);
  });

  it('refuses sign-up from the admin console whatever any switch says', async () => {
    const admin = controller(false, {});
    expect(await admin.isFrontendRegistrationEnabledForRequest(request('admin-ui'))).toBe(false);
  });

  it.each(['app', undefined])('refuses sign-up from a %s client when the app switch is off', async (client) => {
    const caller = controller(false, { [META.APP_REGISTRATION_ENABLED]: false });
    expect(await caller.isFrontendRegistrationEnabledForRequest(request(client))).toBe(false);
  });

  it('gates app sign-in flows by the app sign-in switch', async () => {
    const app = controller(false, { [META.APP_AUTH_ENABLED]: false });
    expect(await app.isFrontendAuthEnabledForRequest(request('app'))).toBe(false);
  });

  it('leaves the admin console its own password reset whatever the customer switches say', async () => {
    const admin = controller(false, { [META.APP_AUTH_ENABLED]: false, [META.FRONTEND_AUTH_ENABLED]: false });
    expect(await admin.isFrontendAuthEnabledForRequest(request('admin-ui'))).toBe(true);
  });
});
