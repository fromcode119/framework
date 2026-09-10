import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginContextMcp } from '@core/plugin/interfaces/plugin-context-mcp.interface';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { McpRegistryProvider } from '@core/mcp/mcp-registry-provider';

/**
 * `context.mcp` — the plugin half of the MCP push model.
 *
 * Thin on purpose: the owner slug is pinned to the plugin's own slug, so the registry's namespace
 * boundary (only `<slug>.*`, reserved names throw) cannot be talked around — a plugin never chooses
 * its owner. The FIRST registration of a context lifetime clears the plugin's previous boot's tools,
 * because `onInit` re-runs in-process on every disable/enable cycle and a collision with its own
 * stale registration would otherwise fail the enable. Later calls in the same lifetime accumulate.
 */
export class McpContextProxy {
  static createMcpProxy(plugin: ILoadedPlugin): IPluginContextMcp {
    let clearedThisLifetime = false;
    return {
      registerTools: (tools: IMcpToolDefinition[]) => {
        const registry = McpRegistryProvider.get();
        if (!clearedThisLifetime) {
          registry.unregisterOwner(plugin.manifest.slug);
          clearedThisLifetime = true;
        }
        registry.register(plugin.manifest.slug, tools);
      },
    };
  }
}
