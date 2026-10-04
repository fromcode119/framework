import { RequestContextUtils } from '@fromcode119/core';
import type { HookManager } from '@fromcode119/core';

/**
 * Registers Sources' hooks so they answer at PLATFORM scope only.
 *
 * Sources is the platform's own build pipeline: listing, syncing, building and deleting the sources
 * every site's extensions come from. Its HTTP routes already sit behind the platform guard, but its
 * hooks are reachable from `context.hooks.call`, which any plugin with the `hooks` capability has —
 * including one a site runs. A call made while a site is bound is a site asking to read or change the
 * platform's sources, and is refused here rather than in each handler, so a hook added later cannot
 * forget the rule.
 *
 * Refused by throwing: `HookManager.call` propagates a handler's error to the caller, so the site sees
 * a refusal instead of an empty answer it could mistake for "there are no sources".
 */
export class PlatformScopedHooks {
  constructor(private readonly hooks: HookManager) {}

  on(event: string, handler: (payload: unknown) => unknown): void {
    this.hooks.on(event, async (payload: unknown) => {
      PlatformScopedHooks.assertPlatformScope(event);
      return handler(payload);
    });
  }

  static assertPlatformScope(event: string): void {
    const tenantId = RequestContextUtils.getTenantId();
    if (tenantId) {
      throw new Error(`"${event}" is a platform control; it cannot be called from site "${tenantId}".`);
    }
  }
}
