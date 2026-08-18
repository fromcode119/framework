import { McpToolRegistry } from '@fromcode119/mcp';
import { CoercionUtils } from '@fromcode119/core';
import { McpTokenScopeMatcher } from '@api/server/mcp-token-scope-matcher';
import { IMcpAuditRecorder } from '@api/controllers/mcp/interfaces/mcp-audit-recorder.interface';
import { IMcpPermissionChecker } from '@api/controllers/mcp/interfaces/mcp-permission-checker.interface';

/**
 * The ONE tool-call gate, transport-free. Extracted from `McpController` so the HTTP endpoint and
 * the hosted Streamable-HTTP transport run IDENTICAL checks — scope, permission, schema presence,
 * required arguments, audit — and can never drift. Both gates are required: the token's scopes limit
 * WHICH tools it may reach; the tool's own `permission` is checked against the caller's roles.
 *
 * `code` is absent on handler failures on purpose — that mirrors the original HTTP behaviour
 * (a failed handler answers 200 with `ok: false`), and the streamable transport maps it to an
 * `isError` tool result rather than a protocol error.
 */
export class McpToolCallService {
  constructor(
    private readonly registry: McpToolRegistry,
    private readonly permissions: IMcpPermissionChecker,
    private readonly audit: IMcpAuditRecorder,
  ) {}

  listTools(user: any, req: unknown) {
    const scopes = user?.mcpScopes;
    return this.registry.listTools({ req }).filter((tool) => McpTokenScopeMatcher.allows(scopes, tool.tool));
  }

  async call(rawName: unknown, rawInput: unknown, user: any, req: unknown, options?: { dryRun?: boolean }): Promise<
    { ok: true; output: unknown } | { ok: false; code?: 400 | 403 | 404; error: string }
  > {
    const name = CoercionUtils.toString(rawName);
    if (!name) return { ok: false, code: 400, error: 'A tool name is required.' };

    // A tool missing a schema or a permission is treated as absent, exactly as `listTools` hides it —
    // otherwise a tool nobody can discover would still be callable by anyone who guessed its name.
    const tool = this.registry.resolve(name, { req });
    if (!tool || !tool.inputSchema || !tool.permission) {
      return { ok: false, code: 404, error: `Unknown MCP tool "${name}".` };
    }

    if (!McpTokenScopeMatcher.allows(user?.mcpScopes, name)) {
      return { ok: false, code: 403, error: `This token is not scoped for "${name}".` };
    }

    const allowed = await this.permissions.hasPermission(Number(user?.id || 0), tool.permission);
    if (!allowed) {
      return { ok: false, code: 403, error: `Permission "${tool.permission}" is required for "${name}".` };
    }

    const input = rawInput && typeof rawInput === 'object' ? rawInput as Record<string, any> : {};
    const missing = this.missingRequired(tool.inputSchema, input);
    if (missing.length) {
      return { ok: false, code: 400, error: `Missing required argument(s): ${missing.join(', ')}.` };
    }

    const userId = String(user?.id || '');
    const argumentKeys = Object.keys(input);

    if (options?.dryRun) {
      this.audit.record({ tool: name, userId, argumentKeys, ok: true, dryRun: true });
      return { ok: true, output: { dryRun: true, tool: name } };
    }

    try {
      const output = await tool.handler(input, { user });
      this.audit.record({ tool: name, userId, argumentKeys, ok: true });
      return { ok: true, output };
    } catch (error: any) {
      const message = String(error?.message || error || `Tool "${name}" failed`);
      this.audit.record({ tool: name, userId, argumentKeys, ok: false, error: message });
      return { ok: false, error: message };
    }
  }

  private missingRequired(schema: Record<string, unknown>, input: Record<string, any>): string[] {
    const required = Array.isArray(schema.required) ? schema.required : [];
    return required.map((k: any) => String(k)).filter((k) => input[k] === undefined);
  }
}
