import type { Request } from 'express';
import { McpToolRegistry } from '@fromcode119/mcp';
import type { IMcpToolDefinition } from '@fromcode119/mcp';
import { AssistantRuntimeFactoryService } from '@ai/api/forge/runtime-factory-service';
import { AssistantManagementToolsService } from '@ai/api/forge/management-tools-service';
import { McpContentTools } from '@ai/admin-assistant-runtime/helpers/mcp-content-tools';
import { McpMiscTools } from '@ai/admin-assistant-runtime/helpers/mcp-misc-tools';

/**
 * Pushes the Admin Assistant's tools into the framework MCP registry as a LAZY source.
 *
 * These tools close over per-request state (the caller's auth headers/cookies drive the
 * restController), so they cannot be declared at boot — the registry evaluates the source on every
 * list/resolve and hands it the live request. `api` does not depend on `ai`; the owner pushes,
 * nothing pulls. A collision with a static framework tool (e.g. `system.now`) resolves to the
 * static one — the registry skips a source tool whose name already exists.
 */
export class AssistantMcpSourceService {
  private static registered = false;

  static register(
    mcp: McpToolRegistry | undefined,
    runtimeFactory: AssistantRuntimeFactoryService,
    managementTools: AssistantManagementToolsService,
  ): void {
    if (!mcp || AssistantMcpSourceService.registered) return;
    mcp.registerSource(McpToolRegistry.FRAMEWORK_OWNER, (context?: Record<string, unknown>): IMcpToolDefinition[] => {
      const req = context?.req as Request | undefined;
      if (!req) return [];
      const options = runtimeFactory.createRuntimeOptions(req);
      return [
        ...McpContentTools.build(options, false),
        ...McpMiscTools.build(options, false),
        ...managementTools.buildTools(),
      ];
    });
    AssistantMcpSourceService.registered = true;
  }
}
