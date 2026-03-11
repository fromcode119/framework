/** Interface definitions for AuthManager */
import type { SignOptions } from 'jsonwebtoken';

export interface User {
  id: string;
  email: string;
  roles: string[];
  jti?: string;
  isApiKey?: boolean;
}

export interface IAuthService {
  hashPassword(password: string): Promise<string>;
  comparePassword(password: string, hash: string): Promise<boolean>;
  generateToken(user: User, options?: { expiresIn?: SignOptions['expiresIn'] }): Promise<string>;
  verifyToken(token: string): Promise<User>;
}
