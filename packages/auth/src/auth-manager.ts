import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { SignOptions } from 'jsonwebtoken';
import { CookieConstants, Logger, RequestSurfaceUtils, RouteConstants } from '@fromcode119/core';
import { UserPermissionChecker } from './permission-checker';
import type { User } from './index.interfaces';
import type { SessionValidator, ApiKeyValidator } from './index.types';

export class AuthManager {
  private secret: string;
  private sessionValidator?: SessionValidator;
  private apiKeyValidator?: ApiKeyValidator;
  private permissionChecker?: UserPermissionChecker;
  private logger = new Logger({ namespace: 'auth-manager' });

  constructor(secret: string = process.env.JWT_SECRET || '') {
    if (!secret) {
      throw new Error('AuthManager: JWT_SECRET must be set in environment variables. No default is allowed for security.');
    }
    this.secret = secret;
  }

  setSessionValidator(validator: SessionValidator) {
    this.sessionValidator = validator;
  }

  setApiKeyValidator(validator: ApiKeyValidator) {
    this.apiKeyValidator = validator;
  }

  setPermissionChecker(checker: UserPermissionChecker) {
    this.permissionChecker = checker;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async generateToken(user: User, options: { expiresIn?: SignOptions['expiresIn'] } = {}): Promise<string> {
    const payload = {
      ...user,
      jti: user.jti || randomUUID(),
    };
    return jwt.sign(payload, this.secret, { expiresIn: options.expiresIn ?? '15m' });
  }

  async generateRefreshToken(user: User): Promise<string> {
    const payload = {
      id: user.id,
      jti: user.jti || randomUUID(),
      type: 'refresh'
    };
    return jwt.sign(payload, this.secret, { expiresIn: '7d' });
  }

  async verifyToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.secret) as any;

      if (decoded.type === 'refresh') {
        throw new Error('Cannot use refresh token as access token');
      }

      if (this.sessionValidator && decoded.jti && !decoded.isApiKey) {
        const isValid = await this.sessionValidator(decoded.jti);
        if (!isValid) throw new Error('Session revoked or expired');
      }

      return decoded as User;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Invalid or expired token');
    }
  }

  async verifyRefreshToken(token: string): Promise<{ id: string, jti: string }> {
    try {
      const decoded = jwt.verify(token, this.secret) as any;
      if (decoded.type !== 'refresh') throw new Error('Invalid refresh token');
      return { id: decoded.id, jti: decoded.jti };
    } catch {
      throw new Error('Invalid refresh token');
    }
  }

  middleware() {
    return async (req: any, res: any, next: any) => {
      const tokenCandidates: string[] = [];
      const sessionCookieNames = this.getSessionCookieNames(req);

      const apiKey = req.headers?.['x-api-key'] || req.query?.api_key;
      if (apiKey && this.apiKeyValidator) {
        try {
          const user = await this.apiKeyValidator(String(apiKey));
          if (user) {
            req.user = { ...user, isApiKey: true };
            return next();
          }
        } catch (e) {
          this.logger.error(`API Key validation failed: ${e}`);
        }
      }

      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const t = authHeader.split(' ')[1];
        if (t && t !== 'undefined' && t !== 'null') {
          tokenCandidates.push(t);
        }
      }

      if (req.headers.cookie) {
        const rawCookies = String(req.headers.cookie).split(';');
        rawCookies.forEach((c) => {
          const parts = c.trim().split('=');
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            if (sessionCookieNames.includes(name) && value && value !== 'undefined' && value !== 'null') {
              tokenCandidates.push(value);
            }
          }
        });
      }

      sessionCookieNames.forEach((cookieName) => {
        if (!req.cookies?.[cookieName]) {
          return;
        }

        if (Array.isArray(req.cookies[cookieName])) {
          req.cookies[cookieName].forEach((t: string) => {
            if (t && !tokenCandidates.includes(t)) tokenCandidates.push(t);
          });
          return;
        }

        if (typeof req.cookies[cookieName] === 'string' && !tokenCandidates.includes(req.cookies[cookieName])) {
          tokenCandidates.push(req.cookies[cookieName]);
        }
      });

      let hasExpiredToken = false;
      for (const t of tokenCandidates) {
        try {
          const user = await this.verifyToken(t);
          if (user) {
            req.user = user;
            this.logger.debug(`Session validated using token candidate (${t.substring(0, 10)}...) for ${req.url || 'unknown'}`);
            break;
          }
        } catch (err: any) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('expired')) {
            hasExpiredToken = true;
          }
          this.logger.debug(`Token candidate failed: ${msg}`);
        }
      }

      if (tokenCandidates.length > 0 && !req.user) {
        if (this.shouldLogTokenFailure(req.url)) {
          this.logger.warn(`All ${tokenCandidates.length} token candidates failed for ${req.url}`);
        }

        if (hasExpiredToken && res.clearCookie) {
          this.logger.info(`Expired token detected for ${req.url}. Clearing auth/security cookies.`);

          const isProd = process.env.NODE_ENV === 'production';
          const isHttps = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' || req.get('x-forwarded-port') === '443';

          const baseOptions: any = {
            path: '/',
            httpOnly: true,
            secure: isProd && isHttps,
            sameSite: 'lax'
          };

          res.clearCookie(CookieConstants.AUTH_TOKEN, baseOptions);
          res.clearCookie(CookieConstants.CLIENT_AUTH_TOKEN, { ...baseOptions, httpOnly: false });
          res.clearCookie(CookieConstants.AUTH_CSRF, { ...baseOptions, httpOnly: false });

          let domain = process.env.COOKIE_DOMAIN;
          if (!domain && req.hostname && req.hostname.includes('.') && !req.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) && req.hostname !== 'localhost') {
            const parts = req.hostname.split('.');
            if (parts.length >= 2) {
              domain = '.' + parts.slice(-2).join('.');
            }
          }

          if (domain) {
            res.clearCookie(CookieConstants.AUTH_TOKEN, { ...baseOptions, domain });
            res.clearCookie(CookieConstants.CLIENT_AUTH_TOKEN, { ...baseOptions, domain, httpOnly: false });
            res.clearCookie(CookieConstants.AUTH_CSRF, { ...baseOptions, domain, httpOnly: false });
          }
        }
      }

      next();
    };
  }

  private getSessionCookieNames(req: any): string[] {
    return this.isAdminRequestContext(req)
      ? [CookieConstants.AUTH_TOKEN]
      : [CookieConstants.CLIENT_AUTH_TOKEN];
  }

  private isAdminRequestContext(req: any): boolean {
    return RequestSurfaceUtils.isAdminRequestContext(req);
  }

  private shouldLogTokenFailure(requestUrl: unknown): boolean {
    const path = String(requestUrl || '').split('?')[0].split('#')[0].trim();
    if (!path) {
      return false;
    }

    const lastSegment = path.split('/').filter(Boolean).pop() || '';
    return lastSegment !== RouteConstants.SEGMENTS.STATUS.slice(1)
      && lastSegment !== RouteConstants.SEGMENTS.HEALTH.slice(1)
      && lastSegment !== RouteConstants.SEGMENTS.READY.slice(1);
  }

  guard(roles: string[] = []) {
    return (req: any, res: any, next: any) => {
      if (!req.user) {
        this.logger.warn(`Guard failed: No user on request for ${req.method} ${req.url}`);
        return res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      }

      if (roles.length > 0) {
        const hasRole = roles.some((role) => req.user.roles.includes(role));
        if (!hasRole) {
          return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
        }
      }

      next();
    };
  }

  requirePermission(permission: string | string[]) {
    return async (req: any, res: any, next: any) => {
      if (!req.user) {
        this.logger.warn(`Permission guard failed: No user on request for ${req.method} ${req.url}`);
        return res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      }

      if (!this.permissionChecker) {
        this.logger.error('Permission checker not configured - falling back to role check');
        const isAdmin = req.user.roles.includes('admin');
        if (!isAdmin) {
          return res.status(403).json({
            error: 'Forbidden: permission system not configured',
            required: permission
          });
        }
        return next();
      }

      const permissions = Array.isArray(permission) ? permission : [permission];
      const userId = parseInt(req.user.id);

      let hasPermission = false;
      for (const perm of permissions) {
        if (await this.permissionChecker.hasPermission(userId, perm)) {
          hasPermission = true;
          break;
        }
      }

      if (!hasPermission) {
        this.logger.warn(`Permission denied for user ${req.user.email}: requires ${permissions.join(' OR ')}`);
        return res.status(403).json({
          error: 'Forbidden: missing required permission',
          required: permissions
        });
      }

      next();
    };
  }
}
