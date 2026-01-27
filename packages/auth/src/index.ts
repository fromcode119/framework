import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

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

  constructor(secret: string = process.env.JWT_SECRET || 'fromcode-removed-historical-secret') {
    this.secret = secret;
  }

  setSessionValidator(validator: SessionValidator) {
    this.sessionValidator = validator;
  }

  setApiKeyValidator(validator: ApiKeyValidator) {
    this.apiKeyValidator = validator;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async generateToken(user: User): Promise<string> {
    const payload = {
      ...user,
      jti: user.jti || Math.random().toString(36).substring(7),
    };
    return jwt.sign(payload, this.secret, { expiresIn: '7d' });
  }

  async verifyToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.secret) as User;
      
      // If server-side session tracking is enabled, check if session is still valid
      if (this.sessionValidator && decoded.jti && !decoded.isApiKey) {
        const isValid = await this.sessionValidator(decoded.jti);
        if (!isValid) throw new Error('Session revoked or expired');
      }

      return decoded;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Invalid or expired token');
    }
  }

  // Middleware for Express to be used in Context
  middleware() {
    return async (req: any, res: any, next: any) => {
      let token: string | undefined;

      // 1. Check for API Key in Header
      const apiKey = req.headers['x-api-key'] || req.query.api_key;
      if (apiKey && this.apiKeyValidator) {
          try {
              const user = await this.apiKeyValidator(String(apiKey));
              if (user) {
                  req.user = { ...user, isApiKey: true };
                  return next();
              }
          } catch (e) {
              console.error('[AuthManager] API Key validation failed', e);
          }
      }

      // 2. Check Authorization Header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const t = authHeader.split(' ')[1];
        if (t && t !== 'undefined' && t !== 'null') {
          token = t;
        }
      }

      // 3. Check Cookies (if cookie-parser is used)
      if (!token && req.cookies) {
        token = req.cookies.fc_token;
        if (token) {
          console.debug(`[AuthManager] Found token in req.cookies for ${req.url}`);
        }
      }

      // 4. Check Cookie in raw header (if cookie-parser is not used or failed)
      if (!token && req.headers.cookie) {
        const rawCookies = String(req.headers.cookie).split(';');
        const cookies: Record<string, string> = {};
        rawCookies.forEach(c => {
          const parts = c.trim().split('=');
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            cookies[name] = value;
          }
        });
        token = cookies['fc_token'];
        if (token) {
          console.debug(`[AuthManager] Found token in raw headers for ${req.url}`);
        }
      }

      if (token && token !== 'undefined' && token !== 'null') {
        try {
          req.user = await this.verifyToken(token);
        } catch (err) {
          if (!req.url.includes('/status') && !req.url.includes('/health') && !req.url.includes('/login')) {
            console.error(`[AuthManager] Token verification failed for ${req.url}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } else {
        if (!req.url.includes('/status') && !req.url.includes('/health')) {
            console.debug(`[AuthManager] No token found for ${req.url}`);
        }
      }
      next();
    };
  }

  // Middleware to enforce authentication
  guard(roles: string[] = []) {
    return (req: any, res: any, next: any) => {
      if (!req.user) {
        console.log(`[AuthManager] Guard failed: No user on request for ${req.method} ${req.url}`);
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
}

export interface IAuthService {
  hashPassword(password: string): Promise<string>;
  comparePassword(password: string, hash: string): Promise<boolean>;
  generateToken(user: User): Promise<string>;
  verifyToken(token: string): Promise<User>;
}
