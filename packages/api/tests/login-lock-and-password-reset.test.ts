import { describe, expect, it, vi } from 'vitest';
import { AuthManager } from '@fromcode119/auth';
import { AuthControllerLifecycle } from '@api/controllers/auth/auth-controller-lifecycle';
import { AuthControllerSso } from '@api/controllers/auth/auth-controller-sso';

/**
 * Five wrong passwords lock an account from one address. The person then resets the password from the
 * emailed link — and must be able to sign in with it straight away, and every refusal caused by the
 * lock must be readable in the Activity log.
 */
describe('a login lock and the password reset that follows it', () => {
  const EMAIL = 'shopper@example.test';
  const ADDRESS = '203.0.113.7';

  const response = () => {
    const res: any = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
  };

  const request = (body: Record<string, unknown>) => ({ body, headers: {}, socket: { remoteAddress: ADDRESS }, ip: ADDRESS });

  /** A controller over an in-memory key/value store, so the lock is the real one and not a stub. */
  const controllerOf = <T>(Controller: new (...args: any[]) => T) => {
    const meta = new Map<string, string>();
    const writeLog = vi.fn(async () => {});
    const db = { findOne: vi.fn(async () => ({ id: 5, email: EMAIL, password: 'stored-hash' })), update: vi.fn(async () => ({})) } as any;
    const controller: any = new Controller({ db, hooks: { call: vi.fn() }, writeLog } as any, new AuthManager('test-secret'));
    controller.db = db;
    Object.assign(controller, {
      readMetaRow: vi.fn(async (key: string) => (meta.has(key) ? { value: meta.get(key) } : null)),
      upsertMeta: vi.fn(async (key: string, value: string) => { meta.set(key, value); }),
      deleteMeta: vi.fn(async (key: string) => { meta.delete(key); }),
      getLoginThrottleSettings: vi.fn(async () => ({ threshold: 5, windowMinutes: 15, lockoutMinutes: 30, captchaEnabled: false, captchaThreshold: 3, addressThreshold: 30, passwordResetLimit: 5 })),
    });
    return { controller, meta, writeLog };
  };

  const lock = async (controller: any) => {
    const key = controller.getLoginThrottleKey(EMAIL, ADDRESS);
    for (let attempt = 0; attempt < 5; attempt++) await controller.recordLoginFailure(key, await controller.getLoginThrottleSettings());
    return key;
  };

  it('writes a refusal caused by the lock to the log', async () => {
    const { controller, writeLog } = controllerOf(AuthControllerLifecycle);
    await lock(controller);
    const res = response();

    await controller.login(request({ email: EMAIL, password: 'the right one' }), res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(writeLog).toHaveBeenCalledTimes(1);
    const [level, message, source, context] = writeLog.mock.calls[0] as any[];
    expect(level).toBe('WARN');
    expect(message).toBe(`Blocked login for ${EMAIL} (Locked After Failed Attempts)`);
    expect(source).toBe('system');
    expect(context).toMatchObject({ email: EMAIL, ip: ADDRESS });
    expect(new Date(context.lockedUntil).getTime()).toBeGreaterThan(Date.now());
  });

  it('lifts the lock when the password is reset from the same address', async () => {
    const { controller, meta } = controllerOf(AuthControllerSso);
    const key = await lock(controller);
    expect(controller.isLoginLocked(await controller.readLoginThrottleState(key))).toBe(true);
    Object.assign(controller, {
      consumePasswordResetToken: vi.fn(async () => ({ ok: true, userId: 5, email: EMAIL })),
      validatePasswordAgainstPolicy: vi.fn(async () => null),
      pushPasswordHistory: vi.fn(async () => {}),
      setForcePasswordReset: vi.fn(async () => {}),
      revokeAllSessionsForUser: vi.fn(async () => {}),
      sendSecurityNotification: vi.fn(async () => {}),
      getPasswordChangedAtKey: () => 'user:5:password_changed_at',
    });
    const res = response();

    await controller.resetPassword(request({ token: 'emailed-token', newPassword: 'a brand new one 9!' }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(meta.has(key)).toBe(false);
    expect(controller.isLoginLocked(await controller.readLoginThrottleState(key))).toBe(false);
  });
});
