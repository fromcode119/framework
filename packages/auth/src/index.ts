import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { SignOptions } from 'jsonwebtoken';
import { Logger } from '@fromcode119/sdk';
import { UserPermissionChecker } from './permission-checker';

export interface User {
  id: string;
  email: string;
  roles: string[];
  jti?: string; 
  isApiKey?: boolean;
}

export type SessionValidator = (jti: string) => Promise<boolean>;
export type ApiKeyValidator = (apiKey: string) => Promise<User | null>;

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
    return jwt.sign(payload, this.secret, { expiresIn: options.expiresIn ?? '15m' }); // Short-lived access token
  }

  async generateRefreshToken(user: User): Promise<string> {
    const payload = {
      id: user.id,
      jti: user.jti || randomUUID(),
      type: 'refresh'
    };
    return jwt.sign(payload, this.secret, { expiresIn: '7d' }); // Long-lived refresh token
  }

  async verifyToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.secret) as any;
      
      if (decoded.type === 'refresh') {
          throw new Error('Cannot use refresh token as access token');
      }

      // If server-side session tracking is enabled, check if session is still valid
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
      } catch (err) {
          throw new Error('Invalid refresh token');
      }
  }

  // Middleware for Express to be used in Context
  middleware() {
    return async (req: any, res: any, next: any) => {
      let token: string | undefined;
      const tokenCandidates: string[] = [];

      // 1. Check for API Key in Header
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

      // 2. Check Authorization Header (highest priority for SPA/Mobile)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const t = authHeader.split(' ')[1];
        if (t && t !== 'undefined' && t !== 'null') {
          tokenCandidates.push(t);
        }
      }

      // 3. Extract ALL cookies with the name 'fc_token' from the raw Cookie header
      // This is the most reliable way to handle the host-specific vs domain-specific cookie conflict.
      if (req.headers.cookie) {
        const rawCookies = String(req.headers.cookie).split(';');
        rawCookies.forEach(c => {
          const parts = c.trim().split('=');
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            if (name === 'fc_token' && value && value !== 'undefined' && value !== 'null') {
              tokenCandidates.push(value);
            }
          }
        });
      }

      // 4. Fallback to req.cookies if populated by middleware
      if (req.cookies?.fc_token) {
        if (Array.isArray(req.cookies.fc_token)) {
          req.cookies.fc_token.forEach((t: string) => {
             if (t && !tokenCandidates.includes(t)) tokenCandidates.push(t);
          });
        } else if (typeof req.cookies.fc_token === 'string' && !tokenCandidates.includes(req.cookies.fc_token)) {
          tokenCandidates.push(req.cookies.fc_token);
        }
      }

      // Try all candidates until one works
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
          // Candidate failed, move to next
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('expired')) {
            hasExpiredToken = true;
          }
          this.logger.debug(`Token candidate failed: ${msg}`);
        }
      }

      if (tokenCandidates.length > 0 && !req.user) {
         if (req.url && !req.url.includes('/status') && !req.url.includes('/health')) {
            this.logger.warn(`All ${tokenCandidates.length} token candidates failed for ${req.url}`);
         }

         // SELF-HEALING: If we have an expired token, clear it to prevent redirect loops or stale sessions
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

            // 1. Clear for exact host
            res.clearCookie('fc_token', baseOptions);
            res.clearCookie('fc_csrf', { ...baseOptions, httpOnly: false });

            // 2. Clear for domain if possible
            let domain = process.env.COOKIE_DOMAIN;
            if (!domain && req.hostname && req.hostname.includes('.') && !req.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) && req.hostname !== 'localhost') {
                const parts = req.hostname.split('.');
                if (parts.length >= 2) {
                    domain = '.' + parts.slice(-2).join('.');
                }
            }

            if (domain) {
                res.clearCookie('fc_token', { ...baseOptions, domain });
                res.clearCookie('fc_csrf', { ...baseOptions, domain, httpOnly: false });
            }
         }
      }

      next();
    };
  }

  // Middleware to enforce authentication
  guard(roles: string[] = []) {
    return (req: any, res: any, next: any) => {
      if (!req.user) {
        this.logger.warn(`Guard failed: No user on request for ${req.method} ${req.url}`);
        return res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      }

      if (roles.length > 0) {
        const hasRole = roles.some(role => req.user.roles.includes(role));
        if (!hasRole) {
          return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
        }
      }

      next();
    };
  }

  // NEW: Permission-based guard (fine-grained access control)
  requirePermission(permission: string | string[]) {
    return async (req: any, res: any, next: any) => {
      if (!req.user) {
        this.logger.warn(`Permission guard failed: No user on request for ${req.method} ${req.url}`);
        return res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      }

      if (!this.permissionChecker) {
        this.logger.error('Permission checker not configured - falling back to role check');
        // Fallback: check if user is admin
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

      // Check if user has ANY of the required permissions
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

export interface IAuthService {
  hashPassword(password: string): Promise<string>;
  comparePassword(password: string, hash: string): Promise<boolean>;
  generateToken(user: User, options?: { expiresIn?: SignOptions['expiresIn'] }): Promise<string>;
  verifyToken(token: string): Promise<User>;
}

export { UserPermissionChecker } from './permission-checker';

