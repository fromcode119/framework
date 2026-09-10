import { McpToolSchemaGuard } from '../mcp-tool-schema-guard';
import { ArchorCommand } from './arch-guard-command';

/** `arch-guard mcp-tool-schemas` — every MCP tool must declare an inputSchema and a permission. */
export class McpToolSchemaCommand extends ArchorCommand {
  readonly summary = 'MCP tools must declare an inputSchema and a permission.';

  run(_argv: string[]): number {
    return McpToolSchemaGuard.run() ?? 0;
  }
}
