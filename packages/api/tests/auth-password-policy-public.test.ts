import { describe, expect, it, vi } from 'vitest';
import { AuthControllerLifecycle } from '@api/controllers/auth/auth-controller-lifecycle';

/**
 * A sign-up form, on a site or in an app, has to state the password rules before anyone types; the
 * only other way to learn them is to be refused one rule at a time.
 */
describe('the public password policy', () => {
  const policy = { minLength: 10, requireUppercase: true, requireLowercase: true, requireNumber: false, requireSymbol: false, breachCheck: true };
  const controller = (frontendAuth: boolean) => {
    const instance: any = Object.create(AuthControllerLifecycle.prototype);
    instance.isFrontendAuthEnabledForRequest = vi.fn(async () => frontendAuth);
    instance.getPasswordPolicySettings = vi.fn(async () => ({ ...policy, historyCount: 5 }));
    return instance;
  };
  const response = () => {
    const res: any = { statusCode: 200, body: null };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (body: unknown) => { res.body = body; return res; };
    return res;
  };

  it('states exactly the rules a sign-up is checked against, and nothing else', async () => {
    const res = response();
    await controller(true).getPasswordPolicy({}, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ...policy, excludesEmailName: true });
  });

  it('is not there where the site has no sign-in for visitors', async () => {
    const res = response();
    await controller(false).getPasswordPolicy({}, res);
    expect(res.statusCode).toBe(404);
  });
});
