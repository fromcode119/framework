import { describe, expect, it, vi } from 'vitest';
import { AuthControllerLifecycle } from '@api/controllers/auth/auth-controller-lifecycle';

/**
 * A site's sign-up switch is about its own website. Turned off, the website offers no sign-up, but an app
 * the site serves still creates accounts through the same endpoint: otherwise every new person in the app
 * is refused, by email and by Apple or Google alike.
 */
describe('the sign-up switch', () => {
  const controller = (fromWebsite: boolean) => {
    const instance: any = Object.create(AuthControllerLifecycle.prototype);
    Object.assign(instance, {
      isFrontendRequestContext: vi.fn(() => fromWebsite),
      getSettingBoolean: vi.fn(async () => false),
    });
    return instance;
  };

  it('closes sign-up on the website when it is off', async () => {
    expect(await controller(true).isFrontendRegistrationEnabledForRequest({})).toBe(false);
  });

  it('leaves sign-up open for an app when it is off', async () => {
    const app = controller(false);
    expect(await app.isFrontendRegistrationEnabledForRequest({})).toBe(true);
    expect(app.getSettingBoolean).not.toHaveBeenCalled();
  });
});
