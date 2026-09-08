import type { IUser } from '@/components/interfaces/user.interface';

/**
 * The value published on the auth context by `AuthProviderView` — mirrors its provider literal
 * `{ user, isLoading, login, logout }` and the exact method signatures behind it, so consumers
 * see the real contract rather than a widened guess.
 */
export interface IAuthContextType {
  user: IUser | null;
  isLoading: boolean;
  /**
   * The server refused this session on THIS host — a 401/403 from `/auth/security` while a readable
   * user cookie said otherwise. It is a distinct answer from `user: null`: "we never had one" sends
   * you to login, "the one we had is not valid here" can also mean a workspace domain your account
   * is not a member of, which deserves saying so rather than a login form you would pass and still
   * be refused by.
   */
  sessionRejected: boolean;
  login: (token: string | undefined, userData: IUser) => void;
  logout: () => Promise<void>;
}
