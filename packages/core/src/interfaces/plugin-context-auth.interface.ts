import type { IPluginRequestHandler } from '@core/interfaces/plugin-request-handler.interface';

/**
 * Auth surface exposed on the plugin context. `guard(roles)` returns Express middleware. Per the
 * fail-closed rule the framework owns the denying default, so a plugin calls these directly and never
 * hand-rolls a fallback: before auth initialises, guards answer 503, `verifyToken` resolves `null`
 * and `isAuthenticated` is `false`.
 */
export interface IPluginContextAuth {
guard(roles?: string[]): IPluginRequestHandler;
requirePermission?(permission: string | string[]): IPluginRequestHandler;
hashPassword(password: string): Promise<string> | string;
comparePassword(password: string, hash: string): Promise<boolean> | boolean;
generateToken(payload: Record<string, unknown>, options?: Record<string, unknown>): string;
/**
 * Resolve the user behind a raw token. ASYNC and never throws: invalid, expired, revoked or
 * unverifiable all resolve to `null`, so the whole guard is
 * `if (!(await context.auth.verifyToken(token))) deny();`.
 *
 * This signature previously claimed to be synchronous and nullable while the implementation was
 * async and throwing, which made the natural guard `if (!context.auth.verifyToken(t))` test a
 * Promise — always truthy, so every request passed. For a request that already went through the
 * framework's auth middleware use {@link IPluginContextAuth.isAuthenticated} instead: being
 * synchronous, a forgotten `await` cannot turn it into an always-true check.
 */
verifyToken(token: string): Promise<Record<string, unknown> | null>;
/** Whether the framework's auth middleware verified a session for this request. Never throws. */
isAuthenticated(request: unknown): boolean;
}
