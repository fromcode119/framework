import express from 'express';

import { CoercionUtils, RateLimiter, SystemConstants } from '@fromcode119/core';
import { McpStreamableHandler } from '@fromcode119/mcp-server';
import { McpController } from '@api/controllers/mcp/mcp-controller';
import { McpToolCallService } from '@api/controllers/mcp/mcp-tool-call-service';
import { McpTokenController } from '@api/controllers/mcp/mcp-token-controller';
import { McpTokenService } from '@api/controllers/mcp/mcp-token-service';
import { McpRouteUtils } from '@api/utils/mcp-route-utils';
import { IMcpRoutesContext } from '@api/routes/interfaces/mcp-routes-context.interface';

/**
 * The generic MCP surface, plus token management, plus the hosted transport.
 *
 * The halves are authenticated DIFFERENTLY on purpose. Tool calls (plain HTTP and the hosted
 * Streamable-HTTP endpoint alike) require an API token (`requireApiToken` rejects session cookies,
 * because scopes live on the token record and a browser session carries none). Token management
 * requires an admin SESSION, so a token cannot mint another token — otherwise a narrowly scoped
 * token could escalate by issuing a wider sibling.
 *
 * The hosted transport (`POST /mcp`) is OFF unless the operator turns on the declared
 * `mcp_remote_enabled` setting (Settings → Integrations → MCP), and is rate limited per address.
 * Both surfaces run the SAME `McpToolCallService`, so they cannot disagree about a gate.
 */
export class McpRouter {
  /** Requests per address per minute on the hosted transport — generous for a client, hostile to a loop. */
  private static readonly REMOTE_RATE_LIMIT_PER_MINUTE = 120;

  static create(context: IMcpRoutesContext): express.Router {
    const router = express.Router();
    const service = new McpToolCallService(context.registry, context.permissions, context.audit);
    const controller = new McpController(service);

    router.get(`${McpRouteUtils.BASE_PATH}/tools`, context.auth.requireApiToken(), (req, res) => controller.listTools(req, res));
    router.post(`${McpRouteUtils.BASE_PATH}/tools/call`, context.auth.requireApiToken(), (req, res) => controller.callTool(req, res));

    McpRouter.registerStreamableTransport(router, context, service);

    // The scope picker needs the tool NAMES while the operator is on an admin SESSION, and
    // `/mcp/tools` is deliberately token-only. Without this the picker asked an endpoint it could
    // never read and permanently showed "no tools registered" — a control that cannot do its job.
    // Names only: no schemas, no handlers, nothing a session should not see.
    router.get(`${McpRouteUtils.BASE_PATH}/scopes`, context.auth.guard(['admin']), (req, res) => {
      // Pass the live request so LAZY sources (the assistant's per-request tools) list here too —
      // without it the picker only ever saw the static framework tools.
      const names = context.registry.listTools({ req }).map((tool) => tool.tool);
      const groups = [...new Set(names.map((name) => `${name.split('.')[0]}.*`))].sort();
      res.json({ tools: names.sort(), groups });
    });

    const tokens = new McpTokenController(new McpTokenService(context.db));
    const adminOnly = context.auth.guard(['admin']);
    router.get(`${McpRouteUtils.BASE_PATH}/tokens`, adminOnly, (req, res) => tokens.listTokens(req, res));
    router.post(`${McpRouteUtils.BASE_PATH}/tokens`, adminOnly, (req, res) => tokens.createToken(req, res));
    router.delete(`${McpRouteUtils.BASE_PATH}/tokens/:tokenId`, adminOnly, (req, res) => tokens.revokeToken(req, res));

    return router;
  }

  private static registerStreamableTransport(router: express.Router, context: IMcpRoutesContext, service: McpToolCallService): void {
    const limiter = new RateLimiter(McpRouter.REMOTE_RATE_LIMIT_PER_MINUTE, 60_000);
    const handler = new McpStreamableHandler({
      listTools: (req: any) => service.listTools(req?.user, req),
      callTool: async (name, args, req: any) => {
        const result = await service.call(name, args, req?.user, req);
        return result.ok ? { ok: true, output: result.output } : { ok: false, error: result.error };
      },
    });

    const requireEnabled = (req: any, res: any, next: any) => {
      // Off by default — the DECLARED `mcp_remote_enabled` setting is the only thing that opens this
      // (read live from the settings mirror, so the admin toggle applies without a restart).
      if (!CoercionUtils.toBoolean(context.settingsCache.get(SystemConstants.META_KEY.MCP_REMOTE_ENABLED))) {
        res.status(403).json({ ok: false, error: 'The hosted MCP transport is disabled. Enable it in Settings → Integrations → MCP.' });
        return;
      }
      const address = String(req.ip || req.headers?.['x-forwarded-for'] || 'unknown');
      if (!limiter.check(`mcp-remote:${address}`)) {
        res.status(429).json({ ok: false, error: 'Rate limit exceeded on the hosted MCP transport.' });
        return;
      }
      next();
    };

    router.post(McpRouteUtils.BASE_PATH, context.auth.requireApiToken(), requireEnabled, (req, res) => {
      void handler.handle(req, res).catch(() => {
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'MCP transport failure.' });
      });
    });
    // Stateless transport: there is no server-initiated stream to GET and no session to DELETE.
    router.get(McpRouteUtils.BASE_PATH, context.auth.requireApiToken(), (_req, res) => { res.status(405).json({ ok: false, error: 'Stateless transport: POST only.' }); });
    router.delete(McpRouteUtils.BASE_PATH, context.auth.requireApiToken(), (_req, res) => { res.status(405).json({ ok: false, error: 'Stateless transport: POST only.' }); });
  }
}
