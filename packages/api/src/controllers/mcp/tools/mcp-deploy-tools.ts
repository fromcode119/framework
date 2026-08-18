import { McpSchema } from '@fromcode119/mcp';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { IMcpToolDependencies } from '@api/controllers/mcp/interfaces/mcp-tool-dependencies.interface';

/**
 * Deploy tools.
 *
 * `deploy.restart` carries its OWN permission (`system:deploy:restart`, seeded by core migration 018)
 * rather than riding on `system:manage`, so restarting a live server is a grant an operator makes
 * deliberately — and its `deploy.*` scope is never part of any wider tool group a token might tick.
 *
 * The handler answers FIRST and exits shortly after, so the caller receives the response before the
 * process dies; the container supervisor (`restart: unless-stopped`) brings the server back.
 */
export class McpDeployTools {
  private static readonly EXIT_DELAY_MS = 500;

  static all(deps: IMcpToolDependencies): IMcpToolDefinition[] {
    return [
      {
        tool: 'deploy.restart',
        title: 'Restart the api server',
        description: 'Gracefully exit the api process so the container supervisor restarts it. The response arrives before the exit.',
        readOnly: false,
        permission: 'system:deploy:restart',
        inputSchema: McpSchema.object({}),
        handler: async (_input, context) => {
          deps.logger.warn(`deploy.restart requested by user ${String(context?.user?.id || 'unknown')} — exiting in ${McpDeployTools.EXIT_DELAY_MS}ms`);
          const timer = setTimeout(() => process.exit(0), McpDeployTools.EXIT_DELAY_MS);
          timer.unref?.();
          return { restarting: true, exitInMs: McpDeployTools.EXIT_DELAY_MS };
        },
      },
    ];
  }
}
