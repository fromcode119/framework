import { describe, expect, it, vi } from 'vitest';
import { AuthControllerAccount } from '@api/controllers/auth/auth-controller-account';

/**
 * An account created through Sign in with Apple or Google has a random password its owner never saw.
 * It must still be able to delete itself (both app stores require it) and pass any other password
 * check — by a fresh sign-in with its provider that names the same verified email.
 */
describe('confirming presence for a password check', () => {
  const user = { id: 7, email: 'Maria@Example.com', password: 'hash' };

  const controller = (identity: Record<string, unknown> | Error, enabled = ['apple', 'google']) => {
    const instance: any = Object.create(AuthControllerAccount.prototype);
    instance.auth = { comparePassword: vi.fn(async (given: string) => given === 'right') };
    instance.manager = {
      hooks: { call: vi.fn(async () => { if (identity instanceof Error) throw identity; return identity; }) },
    };
    instance.getConfiguredSsoProviders = vi.fn(async () => enabled);
    return instance;
  };
  const confirm = (instance: any, body: Record<string, unknown>) =>
    instance.confirmPresence({ body, headers: {}, socket: {} }, user);

  it('still accepts the right password and refuses a wrong one', async () => {
    const instance = controller({});
    expect(await confirm(instance, { password: 'right' })).toBeNull();
    expect(await confirm(instance, { password: 'wrong' })).toBe('Current password is invalid');
  });

  it('accepts a fresh provider sign-in naming the same verified email', async () => {
    const instance = controller({ email: 'maria@example.com', emailVerified: true });
    expect(await confirm(instance, { provider: 'apple', idToken: 'token' })).toBeNull();
    expect(instance.manager.hooks.call).toHaveBeenCalledWith('auth:sso:resolve-user', expect.objectContaining({ provider: 'apple', idToken: 'token' }));
  });

  it('refuses a sign-in for another account, or one whose email the provider does not vouch for', async () => {
    expect(await confirm(controller({ email: 'someone@example.com', emailVerified: true }), { provider: 'google', idToken: 't' }))
      .toBe('This sign-in belongs to a different account');
    expect(await confirm(controller({ email: 'maria@example.com', emailVerified: false }), { provider: 'google', idToken: 't' }))
      .toBe('This sign-in belongs to a different account');
  });

  it('refuses a provider the site has not enabled, a rejected token, and an empty request', async () => {
    expect(await confirm(controller({}, ['google']), { provider: 'apple', idToken: 't' })).toBe('This sign-in provider is not enabled');
    expect(await confirm(controller(new Error('SSO token verification failed: jwt expired')), { provider: 'apple', idToken: 't' }))
      .toBe('SSO token verification failed: jwt expired');
    expect(await confirm(controller({}), {})).toBe('Password is required');
  });
});
