import type { IUser } from '@/components/interfaces/user.interface';

/**
 * The value published on the auth context by `AuthProviderView` — mirrors its provider literal
 * `{ user, isLoading, login, logout }` and the exact method signatures behind it, so consumers
 * see the real contract rather than a widened guess.
 */
export interface IAuthContextType {
  user: IUser | null;
  isLoading: boolean;
  login: (token: string | undefined, userData: IUser) => void;
  logout: () => Promise<void>;
}
