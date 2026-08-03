import type { IUser } from '@auth/interfaces/user.interface';

/** Resolves an API key to its owning user, or null. */
export interface IApiKeyValidator {
  (apiKey: string): Promise<IUser | null>;
}
