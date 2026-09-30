import { afterEach, describe, expect, it, vi } from 'vitest';
import { CookieConstants, SystemConstants } from '@fromcode119/core';
import { AuthControllerSsoOauth } from '@api/controllers/auth/auth-controller-sso-oauth';
import { AccountStatus } from '@api/controllers/auth/enums/account-status.enum';
import { SsoSignInError } from '@api/controllers/auth/sso/enums/sso-sign-in-error.enum';
import { SsoIdentity } from '@api/controllers/auth/sso/sso-identity';
import { SsoOauthClientFactory } from '@api/controllers/auth/sso/sso-oauth-client-factory';
import { SsoOauthState } from '@api/controllers/auth/sso/sso-oauth-state';

/**
 * Social sign-in: the redirect round trip and the one account rule every SSO login shares.
 *
 * The account rule is the security-critical part. An email address joins a provider identity to an
 * account here, so an address the provider did not verify must never sign anybody in — before this,
 * `ssoLogin` signed an EXISTING account in whatever the provider said about the address.
 */

/** Grants that behave like the real ones: valid only for the exact claims they were minted for. */
const grants = {
  generateGrantToken: vi.fn(async (claims: any) => JSON.stringify(claims)),
  verifyGrantToken: vi.fn(async (token: string, expected: any) => {
    try {
      const claims = JSON.parse(token);
      return claims.userId === expected.userId && claims.purpose === expected.purpose && claims.scope === expected.scope;
    } catch {
      return false;
    }
  }),
  hashPassword: vi.fn(async () => 'hashed'),
};

class DatabaseStub {
  readonly inserted: any[] = [];
  constructor(private readonly users: any[] = []) {}
  async findOne(table: string, where: any) {
    return table === SystemConstants.TABLE.USERS ? this.users.find((user) => user.email === where.email) ?? null : null;
  }
  async insert(table: string, row: any) {
    const created = { id: 99, ...row };
    this.inserted.push({ table, row });
    return created;
  }
}

const controller = (db = new DatabaseStub()) => {
  const manager: any = { db, hooks: { call: vi.fn(), emit: vi.fn(), on: vi.fn() }, writeLog: vi.fn(async () => undefined) };
  const instance = new AuthControllerSsoOauth(manager, grants as any);
  const self = instance as any;
  vi.spyOn(self, 'getSettingBoolean').mockResolvedValue(true);
  vi.spyOn(self, 'isFrontendAuthEnabledForRequest').mockResolvedValue(true);
  vi.spyOn(self, 'isFrontendRegistrationEnabled').mockResolvedValue(true);
  vi.spyOn(self, 'getUserAccountStatus').mockResolvedValue(AccountStatus.ACTIVE);
  for (const name of ['setUserAccountStatus', 'setForcePasswordReset', 'pushPasswordHistory', 'upsertMeta', 'setEmailVerified']) {
    vi.spyOn(self, name).mockResolvedValue(undefined);
  }
  vi.spyOn(self, 'getFrontendBaseUrl').mockResolvedValue('https://shop.example');
  vi.spyOn(self, 'isTwoFactorEnabled').mockResolvedValue(false);
  return { instance, self, manager, db };
};

const request = (query: Record<string, string> = {}, cookies: Record<string, string> = {}, provider = 'google') => ({
  params: { provider },
  query,
  cookies,
  headers: { host: 'shop.example', 'user-agent': 'test' },
  get: (name: string) => (name.toLowerCase() === 'host' ? 'shop.example' : undefined),
  path: `/api/v1/auth/sso/${provider}/callback`,
  protocol: 'https',
  secure: true,
  ip: '127.0.0.1',
  socket: { remoteAddress: '127.0.0.1' },
});

const response = () => ({
  cookie: vi.fn(),
  clearCookie: vi.fn(),
  redirect: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
});

const redirectedTo = (res: any): URL => new URL(res.redirect.mock.calls[0][1], 'https://shop.example');

/** A started sign-in: the cookie `start` would have set, for `provider`, returning to `returnTo`. */
const startedCookie = async (provider = 'google', returnTo = '/account', errorTo = '/login') => {
  const state = SsoOauthState.begin(returnTo, errorTo);
  const grant = await grants.generateGrantToken({ userId: provider, purpose: SsoOauthState.PURPOSE, scope: state.scope(provider, null) });
  return { state, cookie: state.serialize(grant) };
};

const fakeClient = (identity: SsoIdentity) => ({
  configured: true,
  authorizationUrl: vi.fn(() => 'https://provider.example/authorize?x=1'),
  identify: vi.fn(async () => identity),
});

afterEach(() => vi.restoreAllMocks());

describe('the account a provider identity signs into', () => {
  const existing = { id: 7, email: 'owner@example.com', roles: ['customer'] };

  it('refuses an address the provider did not verify, even when the account exists', async () => {
    const { self } = controller(new DatabaseStub([existing]));
    const outcome = await self.resolveSsoAccount(request(), new SsoIdentity('owner@example.com', false), 'google');
    expect(outcome).toBe(SsoSignInError.UNVERIFIED_EMAIL);
  });

  it('signs the existing account in for a verified address, without creating another', async () => {
    const { self, db } = controller(new DatabaseStub([existing]));
    const outcome = await self.resolveSsoAccount(request(), new SsoIdentity('owner@example.com', true), 'google');
    expect(outcome).toBe(existing);
    expect(db.inserted).toHaveLength(0);
  });

  it('creates a customer for a new verified address, never with roles the provider supplies', async () => {
    const { self, db, manager } = controller();
    const outcome = await self.resolveSsoAccount(request(), new SsoIdentity('new@example.com', true, 'Ana', 'Petrova'), 'github');
    expect(outcome.id).toBe(99);
    expect(db.inserted[0].row).toMatchObject({ email: 'new@example.com', roles: ['customer'], firstName: 'Ana', lastName: 'Petrova' });
    expect(manager.hooks.emit).toHaveBeenCalledWith('auth:user:registered', expect.objectContaining({ email: 'new@example.com' }));
  });

  it('does not create an account where registration is closed', async () => {
    const { self, db } = controller();
    vi.spyOn(self, 'isFrontendRegistrationEnabled').mockResolvedValue(false);
    const outcome = await self.resolveSsoAccount(request(), new SsoIdentity('new@example.com', true), 'google');
    expect(outcome).toBe(SsoSignInError.REGISTRATION_CLOSED);
    expect(db.inserted).toHaveLength(0);
  });

  it('treats a missing emailVerified in a hook answer as NOT verified', () => {
    expect(SsoIdentity.from({ email: 'a@example.com' }).emailVerified).toBe(false);
    expect(SsoIdentity.from({ email: 'a@example.com', emailVerified: true }).emailVerified).toBe(true);
  });
});

describe('the redirect round trip', () => {
  it('start sends the browser to the provider with state + PKCE and seals them in a cookie scoped to the callback', async () => {
    const { instance } = controller();
    const client = fakeClient(new SsoIdentity('x@example.com', true));
    vi.spyOn(SsoOauthClientFactory.prototype, 'forProvider').mockResolvedValue(client as any);
    const res = response();
    await instance.ssoStart(request({ returnTo: '/checkout', errorTo: '/login' }) as any, res as any);

    const [redirectUri, state, challenge] = client.authorizationUrl.mock.calls[0] as any[];
    expect(redirectUri).toBe('https://shop.example/api/v1/auth/sso/google/callback');
    expect(state).toBeTruthy();
    expect(challenge).toBeTruthy();
    const [name, value, options] = res.cookie.mock.calls[0];
    expect(name).toBe(CookieConstants.SSO_STATE);
    expect(options).toMatchObject({ httpOnly: true, path: '/api/v1/auth/sso/google/callback' });
    expect(SsoOauthState.parse(value)?.state.returnTo).toBe('/checkout');
    expect(res.redirect).toHaveBeenCalledWith(302, 'https://provider.example/authorize?x=1');
  });

  it('start refuses an unknown or unconfigured provider back to the page it came from', async () => {
    const { instance } = controller();
    vi.spyOn(SsoOauthClientFactory.prototype, 'forProvider').mockResolvedValue(null);
    const res = response();
    await instance.ssoStart(request({ errorTo: '/login?next=%2Fcart' }) as any, res as any);
    const target = redirectedTo(res);
    expect(target.pathname).toBe('/login');
    expect(target.searchParams.get('next')).toBe('/cart');
    expect(target.searchParams.get('ssoError')).toBe('not_enabled');
  });

  it('never redirects off-site, whatever returnTo and errorTo say', async () => {
    const { instance } = controller();
    vi.spyOn(SsoOauthClientFactory.prototype, 'forProvider').mockResolvedValue(fakeClient(new SsoIdentity('x@example.com', true)) as any);
    const res = response();
    await instance.ssoStart(request({ returnTo: '//evil.example/steal', errorTo: 'https://evil.example' }) as any, res as any);
    const parsed = SsoOauthState.parse(res.cookie.mock.calls[0][1]);
    expect(parsed?.state.returnTo).toBe('/account');
    expect(parsed?.state.errorTo).toBe('/login');
  });

  it('a callback whose state does not match the cookie is refused', async () => {
    const { instance } = controller();
    const { cookie } = await startedCookie();
    const res = response();
    await instance.ssoCallback(request({ state: 'forged', code: 'c' }, { [CookieConstants.SSO_STATE]: cookie }) as any, res as any);
    expect(redirectedTo(res).searchParams.get('ssoError')).toBe('invalid_state');
  });

  it('a state started for one provider cannot complete on another', async () => {
    const { instance } = controller();
    const { state, cookie } = await startedCookie('github');
    const res = response();
    await instance.ssoCallback(request({ state: state.state, code: 'c' }, { [CookieConstants.SSO_STATE]: cookie }, 'google') as any, res as any);
    expect(redirectedTo(res).searchParams.get('ssoError')).toBe('invalid_state');
  });

  it('an account with two-step verification is sent back to sign in with its password', async () => {
    const { instance, self } = controller(new DatabaseStub([{ id: 7, email: 'owner@example.com' }]));
    vi.spyOn(SsoOauthClientFactory.prototype, 'forProvider').mockResolvedValue(fakeClient(new SsoIdentity('owner@example.com', true)) as any);
    vi.spyOn(self, 'isTwoFactorEnabled').mockResolvedValue(true);
    const completed = vi.spyOn(self, 'completeSsoSignIn');
    const { state, cookie } = await startedCookie();
    const res = response();
    await instance.ssoCallback(request({ state: state.state, code: 'c' }, { [CookieConstants.SSO_STATE]: cookie }) as any, res as any);
    expect(redirectedTo(res).searchParams.get('ssoError')).toBe('two_factor_required');
    expect(completed).not.toHaveBeenCalled();
  });

  it('an unverified address is refused and no session is issued', async () => {
    const { instance, self } = controller(new DatabaseStub([{ id: 7, email: 'owner@example.com' }]));
    vi.spyOn(SsoOauthClientFactory.prototype, 'forProvider').mockResolvedValue(fakeClient(new SsoIdentity('owner@example.com', false)) as any);
    const completed = vi.spyOn(self, 'completeSsoSignIn');
    const { state, cookie } = await startedCookie();
    const res = response();
    await instance.ssoCallback(request({ state: state.state, code: 'c' }, { [CookieConstants.SSO_STATE]: cookie }) as any, res as any);
    expect(redirectedTo(res).searchParams.get('ssoError')).toBe('unverified_email');
    expect(completed).not.toHaveBeenCalled();
  });

  it('a verified sign-in issues the session, leaves the user handoff and returns to where it started', async () => {
    const { instance, self } = controller(new DatabaseStub([{ id: 7, email: 'owner@example.com' }]));
    const client = fakeClient(new SsoIdentity('owner@example.com', true));
    vi.spyOn(SsoOauthClientFactory.prototype, 'forProvider').mockResolvedValue(client as any);
    vi.spyOn(self, 'completeSsoSignIn').mockResolvedValue({ token: 't', user: { id: '7', email: 'owner@example.com', roles: ['customer'], permissions: ['x'] } });
    const { state, cookie } = await startedCookie('google', '/checkout');
    const res = response();
    await instance.ssoCallback(request({ state: state.state, code: 'the-code' }, { [CookieConstants.SSO_STATE]: cookie }) as any, res as any);

    expect(client.identify).toHaveBeenCalledWith('the-code', 'https://shop.example/api/v1/auth/sso/google/callback', state.verifier);
    const handoff = res.cookie.mock.calls.find((call: any[]) => call[0] === CookieConstants.SSO_HANDOFF);
    expect(handoff?.[2]).toMatchObject({ httpOnly: false, domain: undefined });
    expect(JSON.parse(Buffer.from(handoff?.[1], 'base64url').toString('utf8'))).toEqual({ id: '7', email: 'owner@example.com', roles: ['customer'] });
    expect(res.redirect).toHaveBeenCalledWith(302, '/checkout');
  });
});

describe('SsoOauthState.localPath', () => {
  it.each([
    ['/account', '/account'],
    ['/login?next=%2Fcart', '/login?next=%2Fcart'],
    ['//evil.example', ''],
    ['/\\evil.example', ''],
    ['https://evil.example/', ''],
    ['account', ''],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(SsoOauthState.localPath(input)).toBe(expected);
  });
});
