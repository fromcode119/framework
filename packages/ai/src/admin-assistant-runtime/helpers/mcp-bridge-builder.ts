import { McpBridgeFactory } from '@fromcode119/mcp';
import type { IMcpBridge } from '@fromcode119/mcp';
import type { IAdminAssistantRuntimeOptions } from '@ai/admin-assistant-runtime/interfaces/admin-assistant-runtime-options.interface';
import { McpContentTools } from '@ai/admin-assistant-runtime/helpers/mcp-content-tools';
import { McpMiscTools } from '@ai/admin-assistant-runtime/helpers/mcp-misc-tools';

/** Assembles the McpBridge from content + misc tool definitions. */
export class McpBridgeBuilder {
  static async build(options: IAdminAssistantRuntimeOptions, dryRun: boolean): Promise<IMcpBridge> {
    const tools = [
      ...McpContentTools.build(options, dryRun),
      ...McpMiscTools.build(options, dryRun),
    ];

    const extraTools = await Promise.resolve(options.resolveAdditionalTools?.({ dryRun }) || []);
    if (Array.isArray(extraTools) && extraTools.length) {
      for (const tool of extraTools) {
        if (!tool || typeof tool !== 'object' || !tool.tool || typeof tool.handler !== 'function') continue;
        tools.push(tool);
      }
    }

    return McpBridgeFactory.create({ tools });
  }
}
