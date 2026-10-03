import { AuthContextProxy } from '@core/plugin/context/auth';
import { TenantMode } from '@core/tenant/tenant-mode';
import { SystemConstants } from '@core/constants/system.constants';

/** The guard a plugin author writes without reading the implementation. */
class NaiveTokenGuard {
  static async allows(auth: any, token: string): Promise<boolean> {
    return !!(await auth.verifyToken(token));
  }
}

class ThrowingAuthManager {
  readonly secret = 'test-secret';

  async verifyToken(token: string): Promise<Record<string, unknown>> {
    if (token !== 'good') throw new Error('Invalid or expired token');
    return { id: 1, email: 'user@example.com' };
  }

  guard() {
    return (_req: any, _res: any, next: any) => next();
  }

  readSecret(): string {
    return this.secret;
  }
}

describe('AuthContextProxy.verifyToken', () => {
  it('DENIES an invalid token for the naive guard instead of throwing', async () => {
    const auth = AuthContextProxy.createAuthProxy(new ThrowingAuthManager());

    await expect(NaiveTokenGuard.allows(auth, 'tampered')).resolves.toBe(false);
  });

  it('resolves null (never rejects) for an invalid token', async () => {
    const auth = AuthContextProxy.createAuthProxy(new ThrowingAuthManager());

    await expect(auth.verifyToken('tampered')).resolves.toBeNull();
  });

  it('allows a valid token and hands back the decoded payload', async () => {
    const auth = AuthContextProxy.createAuthProxy(new ThrowingAuthManager());

    await expect(NaiveTokenGuard.allows(auth, 'good')).resolves.toBe(true);
    await expect(auth.verifyToken('good')).resolves.toEqual({ id: 1, email: 'user@example.com' });
  });

  it('passes every other member through, still bound to the real manager', () => {
    const auth = AuthContextProxy.createAuthProxy(new ThrowingAuthManager()) as any;

    expect(auth.readSecret()).toBe('test-secret');
    expect(auth.guard()).toBeInstanceOf(Function);
  });
});

describe('AuthContextProxy.isAuthenticated', () => {
  it('is false for an anonymous request', () => {
    expect(AuthContextProxy.isAuthenticated({ headers: {} })).toBe(false);
  });

  it('is false for a missing request', () => {
    expect(AuthContextProxy.isAuthenticated(null)).toBe(false);
    expect(AuthContextProxy.isAuthenticated(undefined)).toBe(false);
  });

  it('is true only once the framework middleware attached a verified user', () => {
    expect(AuthContextProxy.isAuthenticated({ user: { id: 1 } })).toBe(true);
  });
});

describe('AuthContextProxy.platformGuard', () => {
  afterEach(() => TenantMode.reset());

  it('allows an admin in single-tenant mode', () => {
    const next = vi.fn();
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    AuthContextProxy.platformGuard()({ user: { roles: ['admin'] } }, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('refuses a tenant admin and allows a platform admin in multi-tenant mode', () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const next = vi.fn();
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const guard = AuthContextProxy.platformGuard();

    guard({ user: { roles: ['admin'], platformAdmin: false } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    guard({ user: { roles: ['admin'], platformAdmin: true } }, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

/** Two sessions: 'alice' (two-step on) and 'bob' (never turned it on). Anything else does not verify. */
class SessionAuthManager {
  async verifyToken(token: string): Promise<Record<string, unknown>> {
    if (token === 'alice-token') return { id: 7, jti: 'jti-alice' };
    if (token === 'bob-token') return { id: 8, jti: 'jti-bob' };
    throw new Error('Invalid or expired token');
  }
}

class FakeSystemDb {
  readonly meta = new Map<string, string>([['user:7:2fa_enabled', 'true']]);
  readonly sessions = new Map<string, { isRevoked: boolean }>([['jti-alice', { isRevoked: false }], ['jti-bob', { isRevoked: false }]]);
  readonly findOne = vi.fn(async (table: string, where: { key: string }) => {
    expect(table).toBe(SystemConstants.TABLE.META);
    return this.meta.has(where.key) ? { key: where.key, value: this.meta.get(where.key) } : null;
  });
  readonly update = vi.fn(async (table: string, where: { tokenId: string }, patch: { isRevoked: boolean }) => {
    expect(table).toBe(SystemConstants.TABLE.SESSIONS);
    const row = this.sessions.get(where.tokenId);
    if (row) row.isRevoked = patch.isRevoked;
    return row ?? null;
  });
}

describe('AuthContextProxy.twoFactorEnabled', () => {
  it('reads the two-step record of the person the token belongs to', async () => {
    const db = new FakeSystemDb();
    const auth = AuthContextProxy.createAuthProxy(new SessionAuthManager(), db);

    await expect(auth.twoFactorEnabled('alice-token')).resolves.toBe(true);
    await expect(auth.twoFactorEnabled('bob-token')).resolves.toBe(false);
    expect(db.findOne).toHaveBeenCalledWith(SystemConstants.TABLE.META, { key: 'user:7:2fa_enabled' });
  });

  it('answers null — unknown, not "off" — for a token that does not verify, without reading anything', async () => {
    const db = new FakeSystemDb();
    const auth = AuthContextProxy.createAuthProxy(new SessionAuthManager(), db);

    await expect(auth.twoFactorEnabled('forged')).resolves.toBeNull();
    expect(db.findOne).not.toHaveBeenCalled();
  });

  it('answers null when the record cannot be read', async () => {
    const db = new FakeSystemDb();
    db.findOne.mockRejectedValueOnce(new Error('connection lost'));
    const auth = AuthContextProxy.createAuthProxy(new SessionAuthManager(), db);

    await expect(auth.twoFactorEnabled('alice-token')).resolves.toBeNull();
  });
});

describe('AuthContextProxy.revokeSession', () => {
  it('revokes exactly the session the token belongs to', async () => {
    const db = new FakeSystemDb();
    const auth = AuthContextProxy.createAuthProxy(new SessionAuthManager(), db);

    await expect(auth.revokeSession('alice-token')).resolves.toBe(true);
    expect(db.sessions.get('jti-alice')?.isRevoked).toBe(true);
    expect(db.sessions.get('jti-bob')?.isRevoked).toBe(false);
  });

  it('touches nothing for a token that does not verify', async () => {
    const db = new FakeSystemDb();
    const auth = AuthContextProxy.createAuthProxy(new SessionAuthManager(), db);

    await expect(auth.revokeSession('forged')).resolves.toBe(false);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('reports false when the revocation cannot be written', async () => {
    const db = new FakeSystemDb();
    db.update.mockRejectedValueOnce(new Error('connection lost'));
    const auth = AuthContextProxy.createAuthProxy(new SessionAuthManager(), db);

    await expect(auth.revokeSession('alice-token')).resolves.toBe(false);
  });
});

describe('AuthContextProxy with auth not initialised', () => {
  it('cannot answer two-step status or revoke a session', async () => {
    const auth = AuthContextProxy.createAuthProxy(null);

    await expect(auth.twoFactorEnabled('alice-token')).resolves.toBeNull();
    await expect(auth.revokeSession('alice-token')).resolves.toBe(false);
  });

  it('denies the naive token guard', async () => {
    const auth = AuthContextProxy.createAuthProxy(null);

    await expect(NaiveTokenGuard.allows(auth, 'anything')).resolves.toBe(false);
  });

  it('reports every request as anonymous', () => {
    expect(AuthContextProxy.createAuthProxy(undefined).isAuthenticated({ user: { id: 1 } })).toBe(false);
  });

  it('answers 503 from guard and requirePermission rather than calling next', () => {
    const auth = AuthContextProxy.createAuthProxy(null);
    const next = vi.fn();
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    (auth.guard() as any)({}, res, next);
    (auth.requirePermission!('system:manage') as any)({}, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
