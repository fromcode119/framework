import { McpBridgeFactory } from '@fromcode119/mcp';
import type { IMcpBridge } from '@fromcode119/mcp';
import type { IAdminAssistantRuntimeOptions } from '@ai/admin-assistant-runtime/interfaces/admin-assistant-runtime-options.interface';
import { McpContentTools } from '@ai/admin-assistant-runtime/helpers/mcp-content-tools';
import { McpVersionTools } from '@ai/admin-assistant-runtime/helpers/mcp-version-tools';
import { McpMiscTools } from '@ai/admin-assistant-runtime/helpers/mcp-misc-tools';

/** Assembles the McpBridge from content + version + misc tool definitions. */
export class McpBridgeBuilder {
  static async build(options: IAdminAssistantRuntimeOptions, dryRun: boolean): Promise<IMcpBridge> {
    const tools = [
      ...McpContentTools.build(options, dryRun),
      ...McpVersionTools.build(options, dryRun),
      ...McpMiscTools.build(options, dryRun),
    ];

    const extraTools = await Promise.resolve(options.resolveAdditionalTools?.({ dryRun }) || []);
    if (Array.isArray(extraTools) && extraTools.length) {
      for (const tool of extraTools) {
        if (!tool || typeof tool !== 'object' || !tool.tool || typeof tool.handler !== 'function') continue;
        // Rebuilt from the two members the check just proved are there, rather than asserted: the
        // hook's tools arrive as `Partial`, and this is the line that makes one a real definition.
        tools.push({ ...tool, tool: tool.tool, handler: tool.handler });
      }
    }

    return McpBridgeFactory.create({ tools });
  }
}
