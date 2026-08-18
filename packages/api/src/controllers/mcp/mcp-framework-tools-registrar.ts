import { McpToolRegistry } from '@fromcode119/mcp';
import { McpRegistryProvider } from '@fromcode119/core';
import { McpFrameworkTools } from '@api/controllers/mcp/mcp-framework-tools';
import { McpMediaTools } from '@api/controllers/mcp/tools/mcp-media-tools';
import { McpCacheTools } from '@api/controllers/mcp/tools/mcp-cache-tools';
import { McpDeployTools } from '@api/controllers/mcp/tools/mcp-deploy-tools';
import { McpRedirectTools } from '@api/controllers/mcp/tools/mcp-redirect-tools';
import { IMcpToolDependencies } from '@api/controllers/mcp/interfaces/mcp-tool-dependencies.interface';

/**
 * Pushes the api's OWN tools (framework + media) into the core-owned registry, once.
 *
 * The registry singleton lives in core (`McpRegistryProvider`) so core extensions — the AI
 * extension's 39 assistant tools, plugins later — can push into the same instance during their own
 * init. This class exists because the api's tools need api-only dependencies (the media manager);
 * it is the api-side half of the push model, called from route setup where those deps live.
 */
export class McpFrameworkToolsRegistrar {
  private static registered = false;

  /** Registers on the FIRST call (collisions in the registry throw); later calls just return the registry. */
  static ensure(deps: IMcpToolDependencies): McpToolRegistry {
    const registry = McpRegistryProvider.get();
    if (!McpFrameworkToolsRegistrar.registered) {
      registry.register(McpToolRegistry.FRAMEWORK_OWNER, McpFrameworkTools.all());
      registry.register(McpToolRegistry.FRAMEWORK_OWNER, McpMediaTools.all(deps));
      registry.register(McpToolRegistry.FRAMEWORK_OWNER, McpCacheTools.all(deps));
      registry.register(McpToolRegistry.FRAMEWORK_OWNER, McpDeployTools.all(deps));
      registry.register(McpToolRegistry.FRAMEWORK_OWNER, McpRedirectTools.all(deps));
      McpFrameworkToolsRegistrar.registered = true;
    }
    return registry;
  }
}
