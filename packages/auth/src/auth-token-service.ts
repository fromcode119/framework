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

      if (decoded.type === 'refresh') {
        throw new Error('Cannot use refresh token as access token');
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
