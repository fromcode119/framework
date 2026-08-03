import type { IPluginRequestHandler } from '@core/interfaces/plugin-request-handler.interface';

/**
 * Auth surface exposed on the plugin context (the framework AuthManager, or a
 * throwing stub before auth initializes). `guard(roles)` returns Express
 * middleware. Per the fail-closed rule, a fallback for a missing guard must
 * DENY (503), never call next().
 */
export interface IPluginContextAuth {
guard(roles?: string[]): IPluginRequestHandler;
requirePermission?(permission: string | string[]): IPluginRequestHandler;
hashPassword(password: string): Promise<string> | string;
comparePassword(password: string, hash: string): Promise<boolean> | boolean;
generateToken(payload: Record<string, unknown>, options?: Record<string, unknown>): string;
verifyToken(token: string): Record<string, unknown> | null;
}
