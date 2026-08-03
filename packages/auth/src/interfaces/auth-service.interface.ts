import type { SignOptions } from 'jsonwebtoken';
import type { IUser } from '@auth/interfaces/user.interface';

/** Password hashing + token issuing/verification contract. */
export interface IAuthService {
  hashPassword(password: string): Promise<string>;
  comparePassword(password: string, hash: string): Promise<boolean>;
  generateToken(user: IUser, options?: { expiresIn?: SignOptions['expiresIn'] }): Promise<string>;
  verifyToken(token: string): Promise<IUser>;
}
