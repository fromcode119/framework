import type { IPluginContextAuth } from '@core/plugin/interfaces/plugin-context-auth.interface';
import { TenantMode } from '@core/tenant/tenant-mode';
import { RequestContextUtils } from '@core/context/request-context';
import { SystemConstants } from '@core/constants/system.constants';

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
 * - `actor()` names the user a collection write is done for, from the request context the write set.
 * - `twoFactorEnabled(token)` and `revokeSession(token)` answer about, and end, the session the plugin
 *   was HANDED — never an arbitrary user's. An isolated plugin has no network route back to the api, so
 *   it cannot ask the sign-in endpoints itself, and a bearer token has no business leaving the platform
 *   on a self-call anyway.
 * - With auth not yet initialised every member fails CLOSED: guards answer 503, `verifyToken`
 *   resolves `null`, `isAuthenticated` is `false`.
 *
 * Everything else on the manager passes through untouched, so no existing `context.auth.*` call
 * changes behaviour.
 */
export class AuthContextProxy {
  static createAuthProxy(auth: unknown, db?: any): IPluginContextAuth {
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
        if (property === 'actor') {
          return async () => RequestContextUtils.getUser() ?? null;
        }
        if (property === 'platformGuard') {
          return () => AuthContextProxy.platformGuard();
        }
        if (property === 'twoFactorEnabled') {
          return (token: string) => AuthContextProxy.twoFactorEnabled(target, db, token);
        }
        if (property === 'revokeSession') {
          return (token: string) => AuthContextProxy.revokeSession(target, db, token);
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

  static platformGuard(): (req: any, res: any, next: any) => void {
    return (req, res, next) => {
      const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
        return;
      }
      if (!roles.includes('admin') || (TenantMode.isEnabled() && req.user.platformAdmin !== true)) {
        res.status(403).json({ error: 'platform_admin_required' });
        return;
      }
      next();
    };
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
   * Whether the person behind a live token has two-step sign-in turned on — the same record the sign-in
   * form reads. `null` when the token does not verify (or the record cannot be read): the caller cannot
   * know, and must not read that as "off".
   */
  static async twoFactorEnabled(auth: Record<string, unknown>, db: any, token: string): Promise<boolean | null> {
    const user = await AuthContextProxy.verifyToken(auth, token);
    const userId = String(user?.id ?? '').trim();
    if (!userId || !db) return null;
    try {
      const row = await db.findOne(SystemConstants.TABLE.META, { key: `user:${userId}:2fa_enabled` });
      return row?.value === 'true';
    } catch {
      return null;
    }
  }

  /**
   * End the session a live token belongs to, exactly as signing out does. `true` once it is revoked;
   * `false` when the token does not verify (already ended, expired, forged) or the write fails.
   */
  static async revokeSession(auth: Record<string, unknown>, db: any, token: string): Promise<boolean> {
    const user = await AuthContextProxy.verifyToken(auth, token);
    const jti = String(user?.jti ?? '').trim();
    if (!jti || !db) return false;
    try {
      await db.update(SystemConstants.TABLE.SESSIONS, { tokenId: jti }, { isRevoked: true, updatedAt: new Date() });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Auth is not wired yet. Every answer is the denying one, so a plugin never needs a defensive
   * check around `context.auth.*`.
   */
  private static createUnavailableAuth(): IPluginContextAuth {
    return {
      guard: () => (_req: any, res: any) => res.status(503).json({ error: 'auth_unavailable' }),
      platformGuard: () => (_req: any, res: any) => res.status(503).json({ error: 'auth_unavailable' }),
      requirePermission: () => (_req: any, res: any) => res.status(503).json({ error: 'auth_unavailable' }),
      hashPassword: () => { throw new Error('Auth service not initialized'); },
      comparePassword: () => { throw new Error('Auth service not initialized'); },
      generateToken: () => { throw new Error('Auth service not initialized'); },
      verifyToken: async () => null,
      isAuthenticated: () => false,
      actor: async () => null,
      twoFactorEnabled: async () => null,
      revokeSession: async () => false,
    };
  }
}
