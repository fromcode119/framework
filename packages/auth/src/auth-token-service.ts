import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { SignOptions } from 'jsonwebtoken';
import { CookieConstants, Logger, RequestSurfaceUtils, RouteConstants } from '@fromcode119/core';
import { UserPermissionChecker } from '@auth/permission-checker';
import type { IUser } from '@auth/interfaces/user.interface';
import type { ISessionValidator } from '@auth/interfaces/session-validator.interface';
import type { IApiKeyValidator } from '@auth/interfaces/api-key-validator.interface';

/**
 * Hashing passwords and minting/verifying the JWTs.
 *
 * Split out of AuthManager (427 lines) 2026-09-09. It needs the signing secret and the session
 * validator — and the validator is INSTALLED AT RUNTIME via AuthManager.setSessionValidator, so it is
 * taken as an accessor rather than a snapshot; a captured value would go stale the moment the api
 * registers its own validator.
 */
export class AuthTokenService {
  private static readonly TYPE_ACCESS = 'access';
  private static readonly TYPE_GRANT = 'grant';
  /** Long enough to finish an edit, short enough that a leaked grant is worth little. */
  private static readonly GRANT_TTL = '10m';

  constructor(
    private readonly secret: string,
    private readonly sessionValidator: () => ISessionValidator | undefined,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }


  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }


  /**
   * `tenantId` is stated explicitly rather than left to ride along on the user object, so a token
   * is never silently minted without the tenant it belongs to.
   */
  async generateToken(
    user: IUser,
    options: { expiresIn?: SignOptions['expiresIn']; tenantId?: string } = {},
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      ...user,
      jti: user.jti || randomUUID(),
    };
    if (options.tenantId) payload.tenantId = options.tenantId;
    return jwt.sign(payload, this.secret, { algorithm: 'HS256', expiresIn: options.expiresIn ?? '15m' });
  }


  async generateRefreshToken(user: IUser): Promise<string> {
    const payload = {
      id: user.id,
      jti: user.jti || randomUUID(),
      type: 'refresh'
    };
    return jwt.sign(payload, this.secret, { algorithm: 'HS256', expiresIn: '7d' });
  }


  /**
   * `expected.tenantId` is supplied by the caller — this package stays framework-agnostic and does
   * not decide whether the deployment is multi-tenant. When it IS supplied, the token's own claim
   * must match: a token minted for one tenant is refused against another, never re-scoped to
   * whatever tenant the request happened to resolve to.
   *
   * When no tenant is expected (a single-tenant deployment) a token without the claim verifies
   * exactly as before, which is what keeps existing installations working.
   */
  async verifyToken(token: string, expected: { tenantId?: string } = {}): Promise<IUser> {
    try {
      const decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as any;

      // An ALLOWLIST, not a refusal of one known type. Every token this service mints is signed with
      // the SAME secret, so anything else it signs — a refresh token, a short-lived grant — verifies
      // here unless the type is checked positively. Refusing only `refresh` meant a grant token could
      // be presented as an access token and be accepted as the full user.
      if (decoded.type !== undefined && decoded.type !== AuthTokenService.TYPE_ACCESS) {
        throw new Error(`Cannot use "${decoded.type}" token as access token`);
      }

      if (expected.tenantId && decoded.tenantId !== expected.tenantId) {
        throw new Error(
          `Token tenant mismatch: minted for "${decoded.tenantId ?? 'no tenant'}", presented to `
          + `"${expected.tenantId}".`,
        );
      }

      // Resolved ONCE: the validator is installed at runtime, so calling the accessor twice could see
      // two different values between the guard and the call.
      const validator = this.sessionValidator();
      if (validator && !decoded.isApiKey) {
        if (!decoded.jti) throw new Error('Access token has no session identifier');
        const isValid = await validator(decoded.jti);
        if (!isValid) throw new Error('Session revoked or expired');
      }

      return decoded as IUser;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Invalid or expired token');
    }
  }


  /**
   * A short-lived, narrowly SCOPED grant — proof that the operator re-authenticated for one specific
   * privileged act, minted once and presented instead of the credential.
   *
   * It exists so a password never has to be held or replayed. The read-only override used to keep the
   * account password in the admin's memory for the life of the page and send it again in the record
   * body on every save; the server bcrypt-compared it each time. A grant carries no credential, dies
   * on its own, and is refused outside the scope it was minted for.
   *
   * `scope` is an opaque string the CALLER composes (this package does not know what a collection or
   * a record is). It is compared verbatim, so the caller must build it from every dimension that
   * matters — widen the scope and you widen what one password entry authorizes.
   */
  async generateGrantToken(
    claims: { userId: string | number; purpose: string; scope: string },
    options: { expiresIn?: SignOptions['expiresIn'] } = {},
  ): Promise<string> {
    const payload = {
      type: AuthTokenService.TYPE_GRANT,
      sub: String(claims.userId),
      purpose: String(claims.purpose),
      scope: String(claims.scope),
      jti: randomUUID(),
    };
    return jwt.sign(payload, this.secret, { algorithm: 'HS256', expiresIn: options.expiresIn ?? AuthTokenService.GRANT_TTL });
  }


  /**
   * Verifies a grant against the scope it MUST have been minted for. Every dimension is compared —
   * a grant for another user, another purpose or another record is refused, not re-scoped to
   * whatever the current request happens to be.
   */
  async verifyGrantToken(
    token: string,
    expected: { userId: string | number; purpose: string; scope: string },
  ): Promise<boolean> {
    try {
      const decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as any;
      return (
        decoded?.type === AuthTokenService.TYPE_GRANT &&
        String(decoded.sub) === String(expected.userId) &&
        String(decoded.purpose) === String(expected.purpose) &&
        String(decoded.scope) === String(expected.scope)
      );
    } catch {
      return false;
    }
  }


  async verifyRefreshToken(token: string): Promise<{ id: string, jti: string }> {
    try {
      const decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'] }) as any;
      if (decoded.type !== 'refresh') throw new Error('Invalid refresh token');
      return { id: decoded.id, jti: decoded.jti };
    } catch {
      throw new Error('Invalid refresh token');
    }
  }
}
