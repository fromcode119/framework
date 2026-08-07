import type { IPluginContextAuth } from '@core/interfaces/plugin-context-auth.interface';

/**
 * The auth surface handed to a plugin.
 *
 * It exists because the raw `AuthManager` is a **fail-open trap** for the obvious plugin-side guard.
 * `AuthManager.verifyToken` is `async` and THROWS on an invalid token, while the plugin-facing
 * contract declared it synchronous and nullable — so the guard a plugin author naturally writes,
 * `if (!context.auth.verifyToken(token)) deny();`, tests a **Promise object**, which is always
 * truthy, and lets every request through, invalid tokens included. Relying on the declared `null`
 * instead turned the throw into an unhandled rejection.
 *
 * This proxy makes the safe usage the obvious one:
 * - `verifyToken` is async and NEVER throws — invalid, expired, revoked or unverifiable all resolve
 *   to `null`, so `if (!(await context.auth.verifyToken(t))) deny();` is the entire guard.
 * - `isAuthenticated(req)` is the synchronous answer for a request that already passed the
 *   framework's auth middleware, so a forgotten `await` cannot produce an always-true guard at all.
 * - With auth not yet initialised every member fails CLOSED: guards answer 503, `verifyToken`
 *   resolves `null`, `isAuthenticated` is `false`.
 *
 * Everything else on the manager passes through untouched, so no existing `context.auth.*` call
 * changes behaviour.
 */
export class AuthContextProxy {
  static createAuthProxy(auth: unknown): IPluginContextAuth {
    if (!auth) {
      return AuthContextProxy.createUnavailableAuth();
    }

    return new Proxy(auth as Record<string, unknown>, {
      get(target, property) {
        if (property === 'verifyToken') {
          return (token: string) => AuthContextProxy.verifyToken(target, token);
        }
        if (property === 'isAuthenticated') {
          return (request: unknown) => AuthContextProxy.isAuthenticated(request);
        }
        // Receiver is the TARGET, so prototype getters resolve against the real manager; methods come
        // back unbound and pick `this` up from the call site exactly as before this proxy existed.
        return Reflect.get(target, property, target);
      },
    }) as unknown as IPluginContextAuth;
  }

  /** True only when the framework's auth middleware verified a session and attached the user. */
  static isAuthenticated(request: unknown): boolean {
    return !!(request as { user?: unknown } | null)?.user;
  }

  private static async verifyToken(
    auth: Record<string, unknown>,
    token: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const verified = await (auth.verifyToken as (value: string) => unknown).call(auth, token);
      return (verified as Record<string, unknown>) || null;
    } catch {
      // An unverifiable token is not an error the caller has to remember to catch — it is a "no".
      return null;
    }
  }

  /**
   * Auth is not wired yet. Every answer is the denying one, so a plugin never needs a defensive
   * check around `context.auth.*`.
   */
  private static createUnavailableAuth(): IPluginContextAuth {
    return {
      guard: () => (_req: any, res: any) => res.status(503).json({ error: 'auth_unavailable' }),
      requirePermission: () => (_req: any, res: any) => res.status(503).json({ error: 'auth_unavailable' }),
      hashPassword: () => { throw new Error('Auth service not initialized'); },
      comparePassword: () => { throw new Error('Auth service not initialized'); },
      generateToken: () => { throw new Error('Auth service not initialized'); },
      verifyToken: async () => null,
      isAuthenticated: () => false,
    };
  }
}
