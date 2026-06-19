export interface PluginPathReadOptions {
  pluginDirectory?: string;
  themeDirectory?: string;
}

/** Express-shaped request handler — structural so core types stay framework-agnostic. */
export interface PluginRequestHandler {
  (req: any, res: any, next?: (error?: unknown) => void): unknown;
}

/**
 * Cross-plugin event bus exposed on the plugin context. Handlers receive the
 * emitted payload and the event name; `call` collects handler return values.
 */
export interface PluginContextHooks {
  on(event: string, handler: (payload: any, event?: string) => unknown): void;
  off(event: string, handler: (payload: any, event?: string) => unknown): void;
  emit(event: string, payload?: any): void;
  call(event: string, payload?: any): Promise<unknown>;
}

/**
 * Auth surface exposed on the plugin context (the framework AuthManager, or a
 * throwing stub before auth initializes). `guard(roles)` returns Express
 * middleware. Per the fail-closed rule, a fallback for a missing guard must
 * DENY (503), never call next().
 */
export interface PluginContextAuth {
  guard(roles?: string[]): PluginRequestHandler;
  requirePermission?(permission: string | string[]): PluginRequestHandler;
  hashPassword(password: string): Promise<string> | string;
  comparePassword(password: string, hash: string): Promise<boolean> | boolean;
  generateToken(payload: Record<string, unknown>, options?: Record<string, unknown>): string;
  verifyToken(token: string): Record<string, unknown> | null;
}
