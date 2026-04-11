import { RuntimeMiscHelpers } from '../helpers/runtime-misc-helpers';
import { FactualQueryHelpers } from './factual-query-helpers';

export class ReadOnlyChatToolLoopRepairService {
  static async repairToolCalls(
    aiClient: { chat: (params: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; json?: boolean; temperature?: number; maxTokens?: number }) => Promise<{ content?: string; model?: string }> },
    message: string,
    tools: Array<{ tool: string; description: string; metadata?: Record<string, unknown> }>,
    checkpointContext: string,
    baseInput: Record<string, any>,
    seenCalls: Set<string>,
  ): Promise<Array<{ tool: string; input: Record<string, any> }>> {
    if (tools.length === 0) return [];
    const repairPrompt = [
      'Return STRICT JSON only with {"toolCalls":[{"tool":"string","input":{}}]}.',
      'The previous tool-planning response was missing or invalid.',
      'Choose the best one or two read-only tools for the user message.',
      'Reuse checkpoint range/input only if still relevant.',
      'If the user asks for first/earliest use sort asc and limit 1.',
      'If the user asks for last/latest/newest use sort desc and limit 1.',
      'Prefer asking the model to inspect a detail tool instead of repeating a summary tool when the user asks about shipping, weight, color, metadata, line items, status, or payment method.',
      `Checkpoint context: ${checkpointContext || 'none'}`,
      `Candidate tools: ${ReadOnlyChatToolLoopRepairService.serializeToolCatalog(tools)}`,
    ].join('\n');
    try {
      const firstPass = await ReadOnlyChatToolLoopRepairService.requestToolCalls(
        aiClient,
        repairPrompt,
        message,
        true,
      );
      if (firstPass.length > 0) {
        return ReadOnlyChatToolLoopRepairService.filterUnseen(firstPass, seenCalls);
      }
      const secondPass = await ReadOnlyChatToolLoopRepairService.requestToolCalls(
        aiClient,
        `${repairPrompt}\nOutput only one JSON object and no prose.`,
        message,
        false,
      );
      const filtered = ReadOnlyChatToolLoopRepairService.filterUnseen(secondPass, seenCalls);
      return filtered.length > 0
        ? filtered
        : ReadOnlyChatToolLoopRepairService.buildMetadataBackstop(message, tools, baseInput, seenCalls);
    } catch {
      return ReadOnlyChatToolLoopRepairService.buildMetadataBackstop(message, tools, baseInput, seenCalls);
    }
  }

  private static async requestToolCalls(
    aiClient: { chat: (params: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; json?: boolean; temperature?: number; maxTokens?: number }) => Promise<{ content?: string; model?: string }> },
    prompt: string,
    message: string,
    json: boolean,
  ): Promise<Array<{ tool: string; input: Record<string, any> }>> {
    const response = await aiClient.chat({
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: message },
      ],
      json,
      temperature: 0.1,
      maxTokens: 180,
    });
    const parsed = RuntimeMiscHelpers.extractJsonObject(String(response?.content || ''));
    return (Array.isArray((parsed as any)?.toolCalls) ? (parsed as any).toolCalls : [])
      .map((call: any) => ({
        tool: String(call?.tool || '').trim(),
        input: call?.input && typeof call.input === 'object' ? call.input : {},
      }))
      .filter((call: any) => !!call.tool);
  }

  private static filterUnseen(
    toolCalls: Array<{ tool: string; input: Record<string, any> }>,
    seenCalls: Set<string>,
  ): Array<{ tool: string; input: Record<string, any> }> {
    return toolCalls
      .filter((call) => {
        const key = JSON.stringify({ tool: call.tool, input: call.input });
        return call.tool && !seenCalls.has(key);
      })
      .slice(0, 2);
  }

  private static serializeToolCatalog(
    tools: Array<{ tool: string; description: string; metadata?: Record<string, unknown> }>,
  ): string {
    return JSON.stringify(tools.slice(0, 12).map((tool) => ({
      tool: tool.tool,
      description: tool.description,
      metadata: tool.metadata && typeof tool.metadata === 'object'
        ? {
            category: tool.metadata.category,
            entity: tool.metadata.entity,
            filters: tool.metadata.filters,
            returns: tool.metadata.returns,
          }
        : undefined,
    })));
  }

  private static buildMetadataBackstop(
    message: string,
    tools: Array<{ tool: string; description: string; metadata?: Record<string, unknown> }>,
    baseInput: Record<string, any>,
    seenCalls: Set<string>,
  ): Array<{ tool: string; input: Record<string, any> }> {
    const tool = tools.find((entry) => !!entry.tool);
    if (!tool) return [];
    const category = String(tool.metadata?.category || '').trim().toLowerCase();
    const entity = String(tool.metadata?.entity || '').trim().toLowerCase();
    const input = category === 'capability'
      ? {}
      : { ...(baseInput && typeof baseInput === 'object' ? baseInput : {}) };
    if (!input.period && !input.from && !input.to && (
      entity === 'transaction' ||
      entity === 'order' ||
      FactualQueryHelpers.looksLikeEntityDetailQuestion(message)
    )) {
      input.period = 'all_time';
    }
    if (/\b(first|earliest|oldest)\b/i.test(message)) { input.sort = 'asc'; input.limit = 1; }
    if (/\b(last|latest|newest)\b/i.test(message)) { input.sort = 'desc'; input.limit = 1; }
    if ((entity === 'transaction' || entity === 'order') && /\borders?\b/i.test(message) && !input.type) {
      input.type = 'checkout_payment';
    }
    if (category === 'summary') {
      delete input.sort;
      delete input.limit;
      delete input.type;
    }
    const key = JSON.stringify({ tool: tool.tool, input });
    if (seenCalls.has(key)) return [];
    return [{ tool: tool.tool, input }];
  }
}
