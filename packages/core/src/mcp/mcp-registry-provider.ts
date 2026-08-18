import { McpToolRegistry } from '@fromcode119/mcp';

/**
 * The ONE registry every MCP surface reads.
 *
 * A single instance is the point: the stdio transport, the future hosted transport and the in-process
 * Admin Assistant must all see the same tool set, or a tool scoped and audited on one path could be
 * absent — or different — on another.
 *
 * Core owns only the INSTANCE; it knows no tools of its own. Owners PUSH their tools in — the api
 * registers the framework/media tools at route setup, the AI extension registers its lazy per-request
 * source through `context.services.mcp`, and plugins will register through `context.mcp`. Nothing
 * pulls tools out of another package: `api` does not depend on `ai`, and core depends on neither's
 * tool code.
 */
export class McpRegistryProvider {
  private static instance: McpToolRegistry | null = null;

  static get(): McpToolRegistry {
    if (!McpRegistryProvider.instance) {
      McpRegistryProvider.instance = new McpToolRegistry();
    }
    return McpRegistryProvider.instance;
  }
}
