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
        description: 'List the platform\'s URL redirect rules (from, to, type, enabled, hit count), newest first, one page at a time. `total` is how many match; `search` matches the from path, to path and notes.',
        readOnly: true,
        permission: 'system:view',
        inputSchema: McpSchema.object({
          search: McpSchema.string({ description: 'Optional text to find in the from path, to path or notes, e.g. "/brand/".' }),
          page: McpSchema.number({ description: 'Page number, from 1.' }),
          limit: McpSchema.number({ description: 'Rules per page (default 50, at most 1000).' }),
        }),
        handler: async (input: any) => {
          const result = await service.list({ search: input?.search, page: input?.page, limit: input?.limit });
          return { items: result.redirects, count: result.redirects.length, total: result.total, page: result.page, limit: result.limit };
        },
      },
      {
        tool: 'redirects.create',
        title: 'Create a redirect',
        description: 'Create a URL redirect rule (301 permanent by default, 302, or 410 gone — no target). Same validation and duplicate guard as Settings → Redirects; effective immediately.',
        readOnly: false,
        permission: 'system:manage',
        inputSchema: McpSchema.object({
          fromPath: McpSchema.string({ description: 'The path to redirect FROM, e.g. "/old-page".' }),
          toPath: McpSchema.string({ description: 'Where it goes — a path ("/new-page") or absolute URL.' }),
          type: McpSchema.string({ description: '"301" (permanent, default), "302" (temporary) or "410" (gone for good; toPath is ignored).' }),
          notes: McpSchema.string({ description: 'Optional operator note stored with the rule.' }),
        }, ['fromPath', 'toPath']),
        handler: async (input: any = {}) => {
          const type = CoercionUtils.toString(input.type);
          if (type && type !== '301' && type !== '302' && type !== '410') throw new Error('type must be "301", "302" or "410".');
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
