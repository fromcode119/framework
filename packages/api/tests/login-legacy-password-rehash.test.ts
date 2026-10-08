import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { AuthManager } from '@fromcode119/auth';
import { AuthControllerLifecycle } from '@api/controllers/auth/auth-controller-lifecycle';

/**
 * An account imported from another platform signs in with its OLD password once, and from then on
 * holds the framework's own bcrypt hash. These stop the login at the step right after the upgrade
 * (email verification) so only the upgrade itself is under test.
 */
describe('login with an imported password hash', () => {
  const PASSWORD = 'correct horse 9!';
  const WORDPRESS_HASH = '$P$BsaltSALTfDaAX/UI6frCqZDMzLFN91';

  const response = () => {
    const res: any = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
  };

  const controllerFor = (storedHash: string) => {
    const db = {
      findOne: vi.fn(async () => ({ id: 5, email: 'shopper@example.test', password: storedHash })),
      update: vi.fn(async () => ({})),
    } as any;
    const controller: any = new AuthControllerLifecycle({ db, hooks: { call: vi.fn() }, writeLog: vi.fn(async () => {}) } as any, new AuthManager('test-secret'));
    controller.db = db;
    Object.assign(controller, {
      getLoginThrottleSettings: vi.fn(async () => ({})),
      readLoginThrottleState: vi.fn(async () => ({})),
      isLoginLocked: () => false,
      requiresCaptcha: () => false,
      getUserAccountStatus: vi.fn(async () => 'active'),
      recordLoginFailure: vi.fn(async () => {}),
      requiresEmailVerification: vi.fn(async () => true),
    });
    return { controller, db };
  };

  it('replaces a verified legacy hash with the framework\'s bcrypt', async () => {
    const { controller, db } = controllerFor(WORDPRESS_HASH);

    await controller.login({ body: { email: 'shopper@example.test', password: PASSWORD }, headers: {}, socket: {} }, response());

    expect(db.update).toHaveBeenCalledTimes(1);
    const [, where, patch] = db.update.mock.calls[0];
    expect(where).toEqual({ id: 5 });
    expect(patch.password).toMatch(/^\$2[aby]\$/);
    await expect(bcrypt.compare(PASSWORD, patch.password)).resolves.toBe(true);
  });

  it('refuses a wrong password and leaves the legacy hash in place', async () => {
    const { controller, db } = controllerFor(WORDPRESS_HASH);
    const res = response();

    await controller.login({ body: { email: 'shopper@example.test', password: 'wrong' }, headers: {}, socket: {} }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('does not touch a hash that is already the framework\'s own', async () => {
    const { controller, db } = controllerFor(await bcrypt.hash(PASSWORD, 4));

    await controller.login({ body: { email: 'shopper@example.test', password: PASSWORD }, headers: {}, socket: {} }, response());

    expect(db.update).not.toHaveBeenCalled();
  });
});
