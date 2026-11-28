import { describe, expect, it, vi } from 'vitest';
import { AuthControllerLifecycle } from '@api/controllers/auth/auth-controller-lifecycle';

/**
 * A page that sends a visitor to `/register?next=/x` expects them back on /x once they are signed in.
 * The confirmation email is the step in between, so its link carries `next` on to the confirm page —
 * but only a plain same-site path, never an address a browser would follow to another site.
 */
describe('the confirmation link keeps where the person was going', () => {
  const controller = () => {
    const instance: any = Object.create(AuthControllerLifecycle.prototype);
    instance.getFrontendBaseUrl = vi.fn(async () => 'https://site.test');
    return instance;
  };

  it('adds a same-site path as next', async () => {
    const url = await controller().buildEmailVerificationUrl({}, 'tok', '/advent');
    expect(url).toMatch(/\?token=tok&next=%2Fadvent$/);
  });

  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '', undefined, 42])('drops %s', async (next) => {
    const url = await controller().buildEmailVerificationUrl({}, 'tok', next);
    expect(url).not.toContain('next=');
    expect(url).toMatch(/\?token=tok$/);
  });

  it('passes the sign-up request\'s next to the link', async () => {
    const instance: any = Object.create(AuthControllerLifecycle.prototype);
    const build = vi.fn(async () => 'https://site.test/verify?token=t');
    Object.assign(instance, {
      isFrontendAuthEnabledForRequest: vi.fn(async () => true),
      isFrontendRegistrationEnabledForRequest: vi.fn(async () => true),
      validatePasswordAgainstPolicy: vi.fn(async () => null),
      db: { findOne: vi.fn(async () => null), insert: vi.fn(async () => ({ id: 41 })) },
      auth: { hashPassword: vi.fn(async () => 'hash') },
      setUserAccountStatus: vi.fn(async () => undefined),
      setForcePasswordReset: vi.fn(async () => undefined),
      pushPasswordHistory: vi.fn(async () => undefined),
      upsertMeta: vi.fn(async () => undefined),
      joinStorefrontSite: vi.fn(async () => undefined),
      issueEmailVerificationToken: vi.fn(async () => ({ token: 't', expiresAt: new Date() })),
      buildEmailVerificationUrl: build,
      sendVerificationEmail: vi.fn(async () => true),
      manager: { hooks: { emit: vi.fn() }, writeLog: vi.fn(async () => undefined) },
    });
    const res: any = { status: () => res, json: () => res };
    await instance.register({ body: { email: 'maria@example.test', password: 'Valid1234x', next: '/advent' }, headers: {}, socket: {} }, res);
    expect(build).toHaveBeenCalledWith(expect.anything(), 't', '/advent');
  });
});
