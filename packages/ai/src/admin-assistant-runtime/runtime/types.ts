import type { McpBridge, McpToolDefinition } from '@fromcode119/mcp';
import type {
  AdminAssistantRuntimeOptions,
  AssistantAction,
  AssistantChatInput,
  AssistantCollectionContext,
  AssistantSessionCheckpoint,
  AssistantSkillDefinition,
  AssistantToolSummary,
  ProviderCapabilities,
  AssistantWorkspaceMap,
} from '../types';

export class RuntimeUtils {
  static normalizeToolResult(result: any): { ok: boolean; output?: any; error?: string } {
    if (!result || typeof result !== 'object') return { ok: false, error: 'No result' };
    if (result.ok === false) return { ok: false, error: result.error || 'Tool failed' };
    if (result.ok === true) return { ok: true, output: result.output };
    if (result.error) return { ok: false, error: result.error };
    return { ok: true, output: result };
  }

  static listMatchesFromToolOutput(value: any): any[] {
      const output = value && typeof value === 'object' ? value : {};
      const direct = Array.isArray((output as any).matches) ? (output as any).matches : null;
      if (direct) return direct;
      const nested = output && typeof output.output === 'object' && Array.isArray((output as any).output.matches)
        ? (output as any).output.matches
        : null;
      return nested || [];

  }

  static createPlanId(): string {
      return `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  }

  static createBatchId(): string {
      return `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  }

  static toToolSummaryList(tools: McpToolDefinition[]): AssistantToolSummary[] {
      return (Array.isArray(tools) ? tools : [])
        .map((tool) => {
          const toolWithMetadata = tool as McpToolDefinition & { metadata?: Record<string, unknown> };
          return {
            tool: String(toolWithMetadata?.tool || '').trim(),
            description: toolWithMetadata?.description ? String(toolWithMetadata.description) : undefined,
            readOnly: toolWithMetadata?.readOnly === true,
            metadata: toolWithMetadata?.metadata && typeof toolWithMetadata.metadata === 'object'
              ? { ...toolWithMetadata.metadata }
              : undefined,
          };
        })
        .filter((tool) => !!tool.tool);

  }
}
