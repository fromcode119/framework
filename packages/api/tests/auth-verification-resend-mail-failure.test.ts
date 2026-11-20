import { describe, expect, it, vi } from 'vitest';
import { AuthControllerLifecycle } from '@api/controllers/auth/auth-controller-lifecycle';

/**
 * "Send the confirmation again" is limited per person, so a mailbox cannot be flooded. When the site's
 * own mail fails, that request sent nothing, and it must not use up the person's allowance.
 */
describe('resending the confirmation when the site cannot send mail', () => {
  const controller = (emailSent: boolean, meta: Map<string, string>) => {
    const instance: any = Object.create(AuthControllerLifecycle.prototype);
    Object.assign(instance, {
      getSettingBoolean: vi.fn(async () => false),
      readMetaRow: vi.fn(async (key: string) => (meta.has(key) ? { value: meta.get(key) } : null)),
      upsertMeta: vi.fn(async (key: string, value: string) => { meta.set(key, value); }),
      deleteMeta: vi.fn(async (key: string) => { meta.delete(key); }),
      db: { findOne: vi.fn(async () => ({ id: 7, email: 'maria@example.test' })) },
      isEmailVerified: vi.fn(async () => false),
      issueEmailVerificationToken: vi.fn(async () => ({ token: 't', expiresAt: new Date() })),
      buildEmailVerificationUrl: vi.fn(async () => 'https://site.test/verify?token=t'),
      sendVerificationEmail: vi.fn(async () => emailSent),
      readUserFirstName: vi.fn(() => 'Мария'),
      manager: { hooks: { call: vi.fn() } },
    });
    return instance;
  };
  const response = () => {
    const res: any = { statusCode: 200, body: null };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (body: unknown) => { res.body = body; return res; };
    return res;
  };
  const request = () => ({ body: { email: 'maria@example.test' }, headers: {}, socket: { remoteAddress: '203.0.113.9' } });
  const count = (meta: Map<string, string>) => [...meta.values()].map((value) => JSON.parse(value).count)[0] ?? 0;

  it('leaves no count behind when the first resend could not be sent', async () => {
    const meta = new Map<string, string>();
    await controller(false, meta).resendVerification(request(), response());
    expect(count(meta)).toBe(0);
  });

  it('puts an earlier count back as it was', async () => {
    const meta = new Map<string, string>();
    await controller(true, meta).resendVerification(request(), response());
    expect(count(meta)).toBe(1);
    await controller(false, meta).resendVerification(request(), response());
    expect(count(meta)).toBe(1);
  });

  it('counts a resend that was sent', async () => {
    const meta = new Map<string, string>();
    await controller(true, meta).resendVerification(request(), response());
    await controller(true, meta).resendVerification(request(), response());
    expect(count(meta)).toBe(2);
  });
});
