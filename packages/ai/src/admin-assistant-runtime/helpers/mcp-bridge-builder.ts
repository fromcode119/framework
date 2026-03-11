import { McpBridgeFactory } from '@fromcode119/mcp';
import type { McpBridge } from '@fromcode119/mcp';
import type { AdminAssistantRuntimeOptions } from '../types';
import { McpContentTools } from './mcp-content-tools';
import { McpMiscTools } from './mcp-misc-tools';

/** Assembles the McpBridge from content + misc tool definitions. */
export class McpBridgeBuilder {
  static async build(options: AdminAssistantRuntimeOptions, dryRun: boolean): Promise<McpBridge> {
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
