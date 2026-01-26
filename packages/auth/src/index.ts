import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  roles: string[];
  jti?: string; // Add unique token ID for session tracking
}

export type SessionValidator = (jti: string) => Promise<boolean>;

export class AuthManager {
  private secret: string;
  private sessionValidator?: SessionValidator;

  constructor(secret: string = process.env.JWT_SECRET || 'fromcode-default-secret') {
    this.secret = secret;
  }

  setSessionValidator(validator: SessionValidator) {
    this.sessionValidator = validator;
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
      if (this.sessionValidator && decoded.jti) {
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

      // Check Authorization Header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const t = authHeader.split(' ')[1];
        if (t && t !== 'undefined' && t !== 'null') {
          token = t;
        }
      }

      // Check Cookies (if cookie-parser is used)
      if (!token && req.cookies && req.cookies.fc_token) {
        token = req.cookies.fc_token;
        console.log('[AuthManager] Found token in req.cookies');
      }

      // Check Cookie in raw header (if cookie-parser is not used)
      if (!token && req.headers.cookie) {
        const cookies = req.headers.cookie.split(';').reduce((acc: any, cookie: string) => {
          const [name, value] = cookie.trim().split('=');
          acc[name] = value;
          return acc;
        }, {});
        token = cookies['fc_token'];
        if (token) console.log('[AuthManager] Found token in raw cookies');
      }

      if (token) {
        try {
          req.user = await this.verifyToken(token);
        } catch (err) {
          console.error(`[AuthManager] Token verification failed: ${err instanceof Error ? err.message : String(err)}`);
          // Silent failure, req.user remains undefined
        }
      } else {
         // Only log if we have some cookies but not the one we want, to avoid noise
         if (req.headers.cookie && !req.headers.cookie.includes('fc_token')) {
           console.log('[AuthManager] Cookie present but fc_token missing');
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
