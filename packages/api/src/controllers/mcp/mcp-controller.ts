import { CoercionUtils } from '@fromcode119/core';
import { McpToolCallService } from '@api/controllers/mcp/mcp-tool-call-service';

/**
 * The generic MCP surface over plain HTTP: list the tools a caller may see, and call one.
 *
 * All gate logic lives in {@link McpToolCallService} — shared verbatim with the hosted
 * Streamable-HTTP transport, so the two surfaces can never disagree about scope, permission or
 * schema rules. This class only maps the service result onto HTTP.
 */
export class McpController {
  constructor(private readonly service: McpToolCallService) {}

  async listTools(req: any, res: any): Promise<void> {
    // The request goes to the registry so LAZY sources can build their tools from it — the Admin
    // Assistant's tools close over per-request state and cannot be declared at boot.
    res.json({ tools: this.service.listTools(req?.user, req) });
  }

  async callTool(req: any, res: any): Promise<void> {
    const result = await this.service.call(
      req?.body?.tool,
      req?.body?.input,
      req?.user,
      req,
      { dryRun: CoercionUtils.toBoolean(req?.body?.dryRun) },
    );
    if (!result.ok && result.code) {
      res.status(result.code).json({ ok: false, error: result.error });
      return;
    }
    res.json(result.ok ? { ok: true, output: result.output } : { ok: false, error: result.error });
  }
}
