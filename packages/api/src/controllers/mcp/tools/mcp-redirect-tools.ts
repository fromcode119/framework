import { McpSchema } from '@fromcode119/mcp';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { CoercionUtils, SystemRedirectService } from '@fromcode119/core';
import { IMcpToolDependencies } from '@api/controllers/mcp/interfaces/mcp-tool-dependencies.interface';

/**
 * Redirect tools over the FRAMEWORK-owned rule store (`_system_redirects`, Settings → Redirects) —
 * the one place redirect rules live since the per-plugin copies were consolidated. Both tools
 * delegate to `SystemRedirectService`, the same service the admin screen uses, so validation,
 * normalization and the duplicate guard are identical on every surface. A created rule is effective
 * immediately: the resolver looks rules up live on would-be-404 requests.
 */
export class McpRedirectTools {
  static all(deps: IMcpToolDependencies): IMcpToolDefinition[] {
    const service = new SystemRedirectService(deps.db);
    return [
      {
        tool: 'redirects.list',
        title: 'List redirects',
        description: 'List the platform\'s URL redirect rules (from, to, type, enabled, hit count), newest first.',
        readOnly: true,
        permission: 'system:view',
        inputSchema: McpSchema.object({}),
        handler: async () => {
          const items = await service.list();
          return { items, count: items.length };
        },
      },
      {
        tool: 'redirects.create',
        title: 'Create a redirect',
        description: 'Create a URL redirect rule (301 permanent by default, or 302). Same validation and duplicate guard as Settings → Redirects; effective immediately.',
        readOnly: false,
        permission: 'system:manage',
        inputSchema: McpSchema.object({
          fromPath: McpSchema.string({ description: 'The path to redirect FROM, e.g. "/old-page".' }),
          toPath: McpSchema.string({ description: 'Where it goes — a path ("/new-page") or absolute URL.' }),
          type: McpSchema.string({ description: '"301" (permanent, default) or "302" (temporary).' }),
          notes: McpSchema.string({ description: 'Optional operator note stored with the rule.' }),
        }, ['fromPath', 'toPath']),
        handler: async (input: any = {}) => {
          const type = CoercionUtils.toString(input.type);
          if (type && type !== '301' && type !== '302') throw new Error('type must be "301" or "302".');
          const redirect = await service.create({
            fromPath: input.fromPath,
            toPath: input.toPath,
            type: type || '301',
            enabled: true,
            notes: CoercionUtils.toString(input.notes),
          });
          return { ok: true, redirect };
        },
      },
    ];
  }
}
