import { McpSchema } from '@fromcode119/mcp';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { HookEventUtils } from '@fromcode119/core';
import { IMcpToolDependencies } from '@api/controllers/mcp/interfaces/mcp-tool-dependencies.interface';

/**
 * Cache tools.
 *
 * `cache.purge` fires `system:cache:purge`, which every framework cache that can go stale subscribes
 * to (the content ResolutionService today) — the tool never reaches into a cache directly, so a new
 * cache only has to subscribe, not be discovered here.
 *
 * The CDN half is reported HONESTLY: no CDN integration exists in the platform yet, so `cdn` is
 * always false with the reason stated. When a CDN integration ships, this handler must consult its
 * credentials and purge — never claim a purge it did not perform (spec §9.1).
 */
export class McpCacheTools {
  static all(deps: IMcpToolDependencies): IMcpToolDefinition[] {
    return [
      {
        tool: 'cache.purge',
        title: 'Purge the framework cache',
        description: 'Invalidate the framework content caches. Reports whether the CDN was purged too — false when no CDN credentials are configured.',
        readOnly: false,
        permission: 'system:manage',
        inputSchema: McpSchema.object({}),
        handler: async () => {
          await deps.hooks.call(HookEventUtils.HOOK_EVENTS.SYSTEM_CACHE_PURGE, {});
          return { framework: true, cdn: false, reason: 'no CDN credentials configured' };
        },
      },
    ];
  }
}
