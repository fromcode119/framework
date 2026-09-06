import type { IUser } from '@auth/interfaces/user.interface';

/**
 * Resolves an API key to its owning user, or null. Receives the request so a validator can reuse a
 * token record the tenancy layer already resolved (`req.apiToken`) instead of looking it up twice.
 */
export interface IApiKeyValidator {
  (apiKey: string, req?: unknown): Promise<IUser | null>;
}
