import { describe, expect, it, vi } from 'vitest';
import { SystemConstants } from '@fromcode119/core';
import { AuthControllerAnonymous } from '@api/controllers/auth/auth-controller-anonymous';

/**
 * An app may start someone without an account only where the site allows it, and that person can later
 * add an email to the same account — never to an address someone else already has.
 */
describe('starting without an account in an app', () => {
  const META = SystemConstants.META_KEY;
  const response = () => {
    const res: any = { statusCode: 200, body: null };
    res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
    res.json = vi.fn((body: unknown) => { res.body = body; return res; });
    return res;
  };
  const request = (body: Record<string, unknown> = {}, ip = '10.0.0.1', user?: { id: string }): any => ({
    body, user, headers: { 'x-framework-client': 'app' }, ip, socket: { remoteAddress: ip },
    get(name: string) { return (this.headers as Record<string, string>)[name.toLowerCase()]; },
  });
  const controller = (settings: Record<string, boolean>, existingEmails: string[] = []) => {
    const users: Record<string, unknown>[] = [];
    const meta = new Map<string, string>();
    const instance: any = Object.create(AuthControllerAnonymous.prototype);
    Object.assign(instance, {
      isFrontendRequestContext: vi.fn(() => false),
      getSettingBoolean: vi.fn(async (key: string, fallback: boolean) => settings[key] ?? fallback),
      auth: { hashPassword: vi.fn(async (value: string) => `hash:${value}`) },
      db: {
        insert: vi.fn(async (_table: string, row: Record<string, unknown>) => { const made = { id: users.length + 1, ...row }; users.push(made); return made; }),
        findOne: vi.fn(async (_table: string, where: Record<string, unknown>) => (existingEmails.includes(String(where.email)) ? { id: 99 } : null)),
        update: vi.fn(async () => ({})),
      },
      manager: { hooks: { emit: vi.fn(), call: vi.fn() }, writeLog: vi.fn(async () => undefined) },
      setUserAccountStatus: vi.fn(), setForcePasswordReset: vi.fn(), pushPasswordHistory: vi.fn(), setEmailVerified: vi.fn(), joinStorefrontSite: vi.fn(),
      upsertMeta: vi.fn(async (key: string, value: string) => { meta.set(key, value); }),
      deleteMeta: vi.fn(async (key: string) => { meta.delete(key); }),
      getMetaValue: vi.fn(async (key: string) => meta.get(key) ?? null),
      validatePasswordAgainstPolicy: vi.fn(async () => null),
      issueEmailVerificationToken: vi.fn(async () => ({ token: 't' })), buildEmailVerificationUrl: vi.fn(async () => 'https://x/verify'), sendVerificationEmail: vi.fn(async () => true),
      issueLoginSession: vi.fn(async (_req: unknown, _res: unknown, user: { id: number }) => ({ token: 'jwt', user: { id: String(user.id) } })),
    });
    return { instance, users, meta };
  };
  const open = { [META.APP_ANONYMOUS_ENABLED]: true };

  it('is refused while the site has not turned it on', async () => {
    const { instance, users } = controller({});
    const res = response();
    await instance.anonymousSignIn(request(), res);
    expect(res.statusCode).toBe(404);
    expect(users).toHaveLength(0);
  });

  it('is refused when app sign-up is closed, even with the switch on', async () => {
    const { instance } = controller({ ...open, [META.APP_REGISTRATION_ENABLED]: false });
    const res = response();
    await instance.anonymousSignIn(request(), res);
    expect(res.statusCode).toBe(404);
  });

  it('creates an account no email can reach and hands the phone its credentials once', async () => {
    const { instance, users, meta } = controller(open);
    const res = response();
    await instance.anonymousSignIn(request({}, '10.0.0.2'), res);
    expect(res.statusCode).toBe(201);
    expect(String(users[0].email)).toMatch(/^anon-[0-9a-f]{24}@anonymous\.invalid$/);
    expect(res.body.credentials.email).toBe(users[0].email);
    expect(res.body.credentials.password.length).toBeGreaterThan(30);
    expect(users[0].password).toBe(`hash:${res.body.credentials.password}`);
    expect(meta.get('user:1:anonymous')).toBe('true');
  });

  it('starts at most twenty a network address an hour', async () => {
    const { instance, users } = controller(open);
    const codes: number[] = [];
    for (let i = 0; i < 21; i += 1) { const res = response(); await instance.anonymousSignIn(request({}, '10.0.0.3'), res); codes.push(res.statusCode); }
    expect(codes.filter((code) => code === 201)).toHaveLength(20);
    expect(codes[20]).toBe(429);
    expect(users).toHaveLength(20);
  });

  it('tells the app beforehand whether it may start someone this way', async () => {
    const closed = response();
    await controller({}).instance.anonymousAvailability(request(), closed);
    expect(closed.body).toEqual({ available: false });
    const allowed = response();
    await controller(open).instance.anonymousAvailability(request(), allowed);
    expect(allowed.body).toEqual({ available: true });
  });

  it('adds an email to the same account and stops it being anonymous', async () => {
    const { instance, meta } = controller(open);
    meta.set('user:7:anonymous', 'true');
    const res = response();
    await instance.linkAnonymous(request({ email: 'ana@example.com', password: 'Secret-pass-1' }, '10.0.0.4', { id: '7' }), res);
    expect(res.body).toMatchObject({ success: true, requiresEmailVerification: true, user: { id: '7', email: 'ana@example.com' } });
    expect(instance.db.update).toHaveBeenCalledWith(SystemConstants.TABLE.USERS, { id: 7 }, expect.objectContaining({ email: 'ana@example.com' }));
    expect(meta.has('user:7:anonymous')).toBe(false);
  });

  it('refuses an email that already has an account, and an account that is not anonymous', async () => {
    const taken = controller(open, ['ana@example.com']);
    taken.meta.set('user:7:anonymous', 'true');
    const res = response();
    await taken.instance.linkAnonymous(request({ email: 'ana@example.com', password: 'Secret-pass-1' }, '10.0.0.5', { id: '7' }), res);
    expect(res.statusCode).toBe(409);
    const normal = controller(open);
    const res2 = response();
    await normal.instance.linkAnonymous(request({ email: 'b@example.com', password: 'Secret-pass-1' }, '10.0.0.6', { id: '8' }), res2);
    expect(res2.body).toEqual({ error: 'not_anonymous' });
  });
});
