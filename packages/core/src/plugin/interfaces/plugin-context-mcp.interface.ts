import type { IMcpToolDefinition } from '@fromcode119/mcp';

/**
 * A plugin's window onto the framework MCP registry.
 *
 * The registry enforces the namespace boundary: a plugin may register only `<its-slug>.*` tools, and
 * a reserved framework namespace (`content`, `media`, `cache`, …) throws at boot. Registration is
 * called from `on-init.ts`; a re-init replaces the plugin's previous registration rather than
 * colliding with it.
 */
export interface IPluginContextMcp {
  registerTools(tools: IMcpToolDefinition[]): void;
}
