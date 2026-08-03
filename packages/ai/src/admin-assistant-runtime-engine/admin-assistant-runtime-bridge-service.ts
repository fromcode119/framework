import { McpBridgeFactory, type IMcpBridge, type IMcpToolDefinition } from '@fromcode119/mcp';
import type { IAdminAssistantRuntimeOptions } from '@ai/admin-assistant-runtime/interfaces/admin-assistant-runtime-options.interface';
import type { IAssistantToolSummary } from '@ai/admin-assistant-runtime/interfaces/assistant-tool-summary.interface';

export class AdminAssistantRuntimeBridgeService {
  constructor(private readonly options: IAdminAssistantRuntimeOptions) {}

  async buildBridge(dryRun: boolean): Promise<IMcpBridge> {
    const tools: IMcpToolDefinition[] = [];
    const extraTools = await Promise.resolve(this.options.resolveAdditionalTools?.({ dryRun }) || []);
    if (Array.isArray(extraTools)) {
      for (const tool of extraTools) {
        if (!tool || typeof tool !== 'object' || !tool.tool || typeof tool.handler !== 'function') continue;
        tools.push(tool);
      }
    }

    if (!this.hasTool(tools, 'web.search')) {
      tools.push({
        tool: 'web.search',
        readOnly: true,
        description: 'Search the web for current information.',
        handler: async () => ({ ok: false, error: 'web.search is unavailable in this runtime configuration.' }),
      });
    }
    if (!this.hasTool(tools, 'web.fetch')) {
      tools.push({
        tool: 'web.fetch',
        readOnly: true,
        description: 'Fetch and summarize a page by URL.',
        handler: async () => ({ ok: false, error: 'web.fetch is unavailable in this runtime configuration.' }),
      });
    }

    return McpBridgeFactory.create({ tools });
  }

  async listTools(dryRun: boolean = true): Promise<IAssistantToolSummary[]> {
    const bridge = await this.buildBridge(dryRun);
    return (Array.isArray(bridge.listTools()) ? bridge.listTools() : [])
      .map((tool: any) => ({
        tool: String(tool?.tool || '').trim(),
        description: tool?.description ? String(tool.description) : undefined,
        readOnly: tool?.readOnly === true,
        metadata: tool?.metadata && typeof tool.metadata === 'object'
          ? { ...(tool.metadata as Record<string, unknown>) }
          : undefined,
      }))
      .filter((tool) => !!tool.tool);
  }

  private hasTool(tools: IMcpToolDefinition[], name: string): boolean {
    return tools.some((tool) => String(tool?.tool || '').trim() === name);
  }
}
