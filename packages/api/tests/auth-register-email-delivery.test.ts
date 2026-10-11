import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthControllerLifecycle } from '@api/controllers/auth/auth-controller-lifecycle';

/**
 * Sign-up creates the account before it sends the confirmation email. When the email cannot leave,
 * the answer must lead to the verification step (where it can be sent again), not to "try again" —
 * a second sign-up is refused because the account already exists.
 */
describe('sign-up when the confirmation email cannot be sent', () => {
  const env = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = env; });

  const controller = (emailSent: boolean) => {
    const instance: any = Object.create(AuthControllerLifecycle.prototype);
    Object.assign(instance, {
      isFrontendAuthEnabledForRequest: vi.fn(async () => true),
      isFrontendRegistrationEnabled: vi.fn(async () => true),
      validatePasswordAgainstPolicy: vi.fn(async () => null),
      db: { findOne: vi.fn(async () => null), insert: vi.fn(async () => ({ id: 41 })) },
      auth: { hashPassword: vi.fn(async () => 'hash') },
      setUserAccountStatus: vi.fn(async () => undefined),
      setForcePasswordReset: vi.fn(async () => undefined),
      pushPasswordHistory: vi.fn(async () => undefined),
      upsertMeta: vi.fn(async () => undefined),
      joinStorefrontSite: vi.fn(async () => undefined),
      issueEmailVerificationToken: vi.fn(async () => ({ token: 't', expiresAt: new Date() })),
      buildEmailVerificationUrl: vi.fn(async () => 'https://site.test/verify?token=t'),
      sendVerificationEmail: vi.fn(async () => emailSent),
      manager: { hooks: { emit: vi.fn() }, writeLog: vi.fn(async () => undefined) },
    });
    return instance;
  };
  const response = () => {
    const res: any = { statusCode: 200, body: null };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (body: unknown) => { res.body = body; return res; };
    return res;
  };
  const request = { body: { email: 'maria@example.test', password: 'Valid1234x', firstName: 'Мария' }, headers: {}, socket: {} };

  it('reports the account as created and the delivery as failed, in production too', async () => {
    process.env.NODE_ENV = 'production';
    const res = response();
    await controller(false).register(request, res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ success: true, requiresEmailVerification: true, emailDelivery: 'failed' });
    expect(res.body.verificationUrl).toBeUndefined();
  });

  it('reports a sent email as sent', async () => {
    process.env.NODE_ENV = 'production';
    const res = response();
    await controller(true).register(request, res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ requiresEmailVerification: true, emailDelivery: 'sent' });
  });
});
