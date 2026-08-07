import { AuthContextProxy } from '@core/plugin/context/auth';

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

describe('AuthContextProxy with auth not initialised', () => {
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
