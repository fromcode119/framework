import { McpSchema } from '@fromcode119/mcp';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import {
  ApplicationRestartService,
  ApplicationUrlUtils,
  CoercionUtils,
  FrontendSsrStatusService,
  InternalServiceAuth,
} from '@fromcode119/core';
import { IMcpToolDependencies } from '@api/controllers/mcp/interfaces/mcp-tool-dependencies.interface';

/**
 * Deploy tools.
 *
 * `deploy.restart` carries its OWN permission (`system:deploy:restart`, seeded by core migration 018)
 * rather than riding on `system:manage`, so restarting a live server is a grant an operator makes
 * deliberately — and its `deploy.*` scope is never part of any wider tool group a token might tick.
 *
 * It restarts ANY app of the deployment, not just the api. The api is a self-exit the supervisor
 * reverses; the admin and frontend are separate processes reached over the internal channel. Both go
 * through {@link ApplicationRestartService} — the same one the admin's restart buttons and the REST
 * route use — so there is exactly one definition of what "restart" means.
 *
 * Restarting only the api used to be the sole option here, which made a whole class of deployment state
 * unreachable: the frontend caches the theme's server bundle for the life of its process, so after a
 * theme install it serves stale (or content-free) pages until IT restarts — and an operator driving the
 * server through MCP had no way to do that without shell access to the host.
 */
export class McpDeployTools {
  /** `all` is not an app — it is every app this deployment declares, restarted in a safe order. */
  private static readonly ALL = 'all';

  static all(deps: IMcpToolDependencies): IMcpToolDefinition[] {
    return [
      {
        tool: 'deploy.apps',
        title: 'List restartable apps',
        description:
          'The apps this deployment can restart and whether each is actually reachable right now. '
          + 'Read this before deploy.restart: an app with restartable=false states WHY (no internal '
          + 'URL declared, or no shared secret configured), instead of failing at restart time.',
        readOnly: true,
        permission: 'system:deploy:restart',
        inputSchema: McpSchema.object({}),
        handler: async () => McpDeployTools.describeApps(),
      },
      {
        tool: 'deploy.ssrStatus',
        title: 'What the frontend can see (server rendering)',
        description:
          'Ask the FRONTEND process what it can see of the theme and plugin server-render bundles. '
          + 'Use this when pages render no content: the api listing a theme\'s ui-ssr files proves '
          + 'nothing, because the frontend is a separate container and may be looking at a different '
          + 'directory — or none. Returns a one-line diagnosis naming the actual cause.',
        readOnly: true,
        permission: 'system:deploy:restart',
        inputSchema: McpSchema.object({}),
        handler: async () => FrontendSsrStatusService.read(),
      },
      {
        tool: 'deploy.restart',
        title: 'Restart an app (or the whole deployment)',
        description:
          'Gracefully restart one app — "api", "admin" or "frontend" — or "all" for every app this '
          + 'deployment declares. Defaults to "api". The response arrives before anything exits. '
          + 'Restart the frontend after installing or updating a theme: it loads the theme\'s server '
          + 'render bundle once at boot and keeps that result for the life of the process.',
        readOnly: false,
        permission: 'system:deploy:restart',
        // `app` is deliberately NOT required: an existing caller that sends no argument keeps getting
        // the api restart this tool has always performed.
        inputSchema: McpSchema.object({
          app: McpSchema.string({
            description: `Which app to restart: ${ApplicationRestartService.APPS.join(', ')}, or "${McpDeployTools.ALL}". Defaults to "${ApplicationUrlUtils.API_APP}".`,
          }),
        }),
        handler: async (input, context) => {
          const requestedBy = `MCP user ${String(context?.user?.id || 'unknown')}`;
          const requested = CoercionUtils.toString((input as Record<string, unknown>)?.app)
            .trim()
            .toLowerCase() || ApplicationUrlUtils.API_APP;
          const service = new ApplicationRestartService(deps.logger);

          if (requested === McpDeployTools.ALL) {
            return McpDeployTools.restartEverything(service, requestedBy, deps);
          }
          if (!ApplicationRestartService.supports(requested)) {
            return {
              error: `Unknown app "${requested}".`,
              supported: [...ApplicationRestartService.APPS, McpDeployTools.ALL],
            };
          }

          deps.logger.info(`[mcp] deploy.restart ${requested} requested by ${requestedBy}`);
          const outcome = await service.restart(requested, requestedBy);
          return outcome.toJSON();
        },
      },
    ];
  }

  /**
   * Every app, api LAST.
   *
   * The api is the process answering this call: once it schedules its exit it can no longer reach the
   * others. Restarting the remote apps first — and awaiting their outcomes — is what makes "all"
   * actually mean all, rather than "the api, and whatever else happened to get a request in first".
   */
  private static async restartEverything(
    service: ApplicationRestartService,
    requestedBy: string,
    deps: IMcpToolDependencies,
  ): Promise<Record<string, unknown>> {
    deps.logger.info(`[mcp] deploy.restart ALL apps requested by ${requestedBy}`);
    const remoteApps = ApplicationRestartService.APPS.filter((app) => app !== ApplicationUrlUtils.API_APP);
    const results: Record<string, unknown>[] = [];

    for (const app of remoteApps) {
      const outcome = await service.restart(app, requestedBy);
      results.push(outcome.toJSON());
    }
    const api = await service.restart(ApplicationUrlUtils.API_APP, requestedBy);
    results.push(api.toJSON());

    return {
      results,
      restarted: results.filter((result) => result.restarting).map((result) => result.app),
      // Named separately so a partial outcome cannot read as a success: an app that refused says so
      // here with its reason, next to the ones that are actually coming back.
      skipped: results.filter((result) => !result.restarting).map((result) => ({ app: result.app, reason: result.reason })),
    };
  }

  /** Mirrors the admin's own app list (`SystemDeployController.listApps`) so both agree on reachability. */
  private static describeApps(): Record<string, unknown> {
    const secretConfigured = InternalServiceAuth.isConfigured();
    return {
      secretEnvKey: InternalServiceAuth.ENV_KEY,
      secretConfigured,
      apps: ApplicationRestartService.APPS.map((app) => {
        // The api exits in place, so it calls nothing and needs neither a URL nor the secret.
        const isSelf = app === ApplicationUrlUtils.API_APP;
        const url = isSelf ? '' : ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment(app);
        return {
          app,
          url,
          restartable: isSelf || (secretConfigured && Boolean(url)),
          reason: isSelf || (secretConfigured && Boolean(url))
            ? ''
            : McpDeployTools.unreachableReason(app, secretConfigured, url),
        };
      }),
    };
  }

  private static unreachableReason(app: string, secretConfigured: boolean, url: string): string {
    if (!secretConfigured) {
      return `${InternalServiceAuth.ENV_KEY} is not set, so the ${app} app cannot verify an internal call. Set the same value on the api, admin and frontend services.`;
    }
    return url
      ? ''
      : `This deployment has not declared where the ${app} app runs. Set INTERNAL_${app.toUpperCase()}_URL (or ${app.toUpperCase()}_URL) on the api service if it runs one.`;
  }
}
