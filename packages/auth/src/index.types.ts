/** Type aliases for AuthManager */
import type { User } from './index.interfaces';

export type SessionValidator = (jti: string) => Promise<boolean>;
export type ApiKeyValidator = (apiKey: string) => Promise<User | null>;
