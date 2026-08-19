import { McpSchema } from '@fromcode119/mcp';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { ProcessRestartService } from '@fromcode119/core';
import { IMcpToolDependencies } from '@api/controllers/mcp/interfaces/mcp-tool-dependencies.interface';

/**
 * Deploy tools.
 *
 * `deploy.restart` carries its OWN permission (`system:deploy:restart`, seeded by core migration 018)
 * rather than riding on `system:manage`, so restarting a live server is a grant an operator makes
 * deliberately — and its `deploy.*` scope is never part of any wider tool group a token might tick.
 *
 * The handler answers FIRST and exits shortly after, so the caller receives the response before the
 * process dies; the container supervisor (`restart: unless-stopped`) brings the server back. The exit
 * itself belongs to {@link ProcessRestartService} — the same one the admin's restart buttons use, so
 * there is exactly one definition of what "restart" means.
 */
export class McpDeployTools {
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
          const exit = ProcessRestartService.scheduleExit(
            `deploy.restart requested by user ${String(context?.user?.id || 'unknown')}`,
            deps.logger,
          );
          return { restarting: exit.scheduled, exitInMs: exit.exitInMs };
        },
      },
    ];
  }
}
