import { McpSchema } from '@fromcode119/mcp';
import { IMcpToolDefinition } from '@fromcode119/mcp';

/**
 * The framework's own MCP tools.
 *
 * `system.now` is deliberately the first one: it is read-only, takes no arguments and touches nothing,
 * so it is the tool that proves the whole path — registry, scope check, permission check, transport —
 * without any risk attached to what it returns. The remaining framework tools are schema'd in a later
 * phase; until then they stay hidden rather than callable-but-unspecified.
 */
export class McpFrameworkTools {
  static all(): IMcpToolDefinition[] {
    return [
      {
        tool: 'system.now',
        title: 'Current server time',
        description: 'The platform server’s current time, as an ISO-8601 string.',
        readOnly: true,
        permission: 'content:read',
        inputSchema: McpSchema.object({}),
        handler: () => ({ now: new Date().toISOString() }),
      },
    ];
  }
}
