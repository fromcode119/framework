import { RuntimeMiscHelpers } from '../helpers/runtime-misc-helpers';
import { ReplyMessageBuilders } from '../helpers/reply-message-builders';
import { FactualQueryHelpers } from './factual-query-helpers';
import { FactualQueryToolService } from './factual-query-tool-service';
import { ReadOnlyChatToolLoopRepairService } from './read-only-chat-tool-loop-repair-service';
import type { RuntimeContext } from './types.types';
import type { ChatReply } from './chat-responder.types';

export class ReadOnlyChatToolLoop {
  static requiresToolGrounding(message: string): boolean {
    const text = String(message || '').trim();
    if (!text) {
      return false;
    }
    return (
      FactualQueryHelpers.looksLikeReadOnlyDataQuestion(text) ||
      /\b(can you access|do you have access|can you use|can you see|do you see|is .* available|is .* enabled|is .* installed)\b/i.test(text)
    );
  }

  static async generateReply(input: {
    context: RuntimeContext;
    systemPrompt: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    message: string;
    aiClient: { chat: (params: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; json?: boolean; temperature?: number; maxTokens?: number }) => Promise<{ content?: string; model?: string }> };
    temperature: number;
    maxTokens: number;
    provider: string;
  }): Promise<ChatReply | null> {
    const readOnlyTools = ReadOnlyChatToolLoop.selectReadOnlyTools(input.context, input.message);
    const checkpointContext = ReadOnlyChatToolLoop.buildCheckpointContext(input.context);
    const toolResults: Array<{ tool: string; input: Record<string, any>; result: any }> = [];
    const seenCalls = new Set<string>();

    if (readOnlyTools.length === 0) {
      return null;
    }

    for (let iteration = 0; iteration < 3; iteration += 1) {
      const toolPlan = await ReadOnlyChatToolLoop.planToolCalls({
        aiClient: input.aiClient,
        systemPrompt: input.systemPrompt,
        history: input.history,
        message: input.message,
        tools: readOnlyTools,
        toolResults,
        checkpointContext,
        temperature: input.temperature,
        maxTokens: Math.min(360, input.maxTokens),
      });
      const plannedToolCalls = (Array.isArray(toolPlan?.toolCalls) ? toolPlan?.toolCalls : [])
        .slice(0, 2)
        .filter((call) => {
          const toolName = String(call?.tool || '').trim();
          const toolInput = call?.input && typeof call.input === 'object' ? call.input : {};
          const key = JSON.stringify({ tool: toolName, input: toolInput });
          if (!toolName || seenCalls.has(key)) return false;
          seenCalls.add(key);
          return true;
        });
      const toolCalls = plannedToolCalls.length > 0
        ? plannedToolCalls
        : await ReadOnlyChatToolLoopRepairService.repairToolCalls(
            input.aiClient,
            input.message,
            readOnlyTools,
            checkpointContext,
            {
              ...(input.context.checkpoint?.memory?.factual?.input && typeof input.context.checkpoint.memory.factual.input === 'object'
                ? input.context.checkpoint.memory.factual.input as Record<string, any>
                : {}),
              ...FactualQueryHelpers.buildToolInput(input.message),
            },
            seenCalls,
          );
      if (toolCalls.length === 0) {
        const directMessage = String(toolPlan?.message || '').trim();
        if (directMessage && (toolResults.length > 0 || !ReadOnlyChatToolLoop.requiresToolGrounding(input.message))) {
          return {
            message: directMessage,
            model: String(toolPlan?.model || input.provider || 'ai'),
            source: 'tool_model',
          };
        }
        break;
      }

      for (const call of toolCalls) {
        const toolName = String(call?.tool || '').trim();
        const toolInput = call?.input && typeof call.input === 'object' ? call.input : {};
        const result = await input.context.bridge.call({
          tool: toolName,
          input: toolInput,
          context: { dryRun: true },
        });
        toolResults.push({ tool: toolName, input: toolInput, result });
      }
    }

    if (toolResults.length === 0) {
      return null;
    }

    const groundedReply = await ReadOnlyChatToolLoop.summarizeToolResults({
      aiClient: input.aiClient,
      systemPrompt: input.systemPrompt,
      history: input.history,
      message: input.message,
      toolResults,
      checkpointContext,
      temperature: Math.min(0.15, input.temperature),
      maxTokens: Math.min(320, input.maxTokens),
      provider: input.provider,
    });
    if (groundedReply) {
      return groundedReply;
    }

    return {
      message: ReplyMessageBuilders.buildToolResultsFallbackMessage(
        toolResults,
        '',
        RuntimeMiscHelpers.formatToolLabel,
      ),
      model: input.provider || 'tool-summary',
      source: 'tool_model',
    };
  }

  private static async planToolCalls(input: {
    aiClient: { chat: (params: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; json?: boolean; temperature?: number; maxTokens?: number }) => Promise<{ content?: string; model?: string }> };
    systemPrompt: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    message: string;
    tools: Array<{ tool: string; description: string; metadata?: Record<string, unknown> }>;
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>;
    checkpointContext?: string;
    temperature: number;
    maxTokens: number;
  }): Promise<{ message: string; toolCalls: Array<{ tool: string; input: Record<string, any> }>; model: string } | null> {
    const plannerPromptLines = [
      input.systemPrompt,
      '',
      'You can answer read-only workspace questions by selecting read-only tools.',
      'Prefer a useful grounded answer over a vague fallback.',
      'For workspace data, plugin-access, or business metric questions, do not guess and do not claim lack of access before checking tools.',
      'When the user asks a follow-up, reuse prior factual range/context only if it is relevant to the new question.',
      'If the follow-up changes from a summary question to an entity/detail question, pick a more appropriate read-only tool instead of repeating the previous summary.',
      'You may ask for more data by returning toolCalls after seeing prior tool results. Stop only when you have enough grounded evidence to answer.',
      'Return STRICT JSON only with this shape:',
      '{"message":"string","toolCalls":[{"tool":"string","input":{}}]}',
      'Use at most 2 read-only tool calls.',
      'Only return toolCalls as an empty array when the answer is already obvious from the conversation and does not require workspace inspection.',
      `Available read-only tools: ${ReadOnlyChatToolLoop.serializeToolCatalog(input.tools)}`,
    ];
    if (input.checkpointContext) {
      plannerPromptLines.push(`Checkpoint context: ${input.checkpointContext}`);
    }
    if (input.toolResults.length > 0) {
      plannerPromptLines.push(`Prior tool results: ${JSON.stringify(input.toolResults)}`);
    }
    const plannerPrompt = plannerPromptLines.join('\n');

    try {
      const response = await input.aiClient.chat({
        messages: [
          { role: 'system', content: plannerPrompt },
          ...input.history,
          { role: 'user', content: input.message },
        ],
        json: true,
        temperature: Math.min(0.2, input.temperature),
        maxTokens: input.maxTokens,
      });
      const parsed = RuntimeMiscHelpers.extractJsonObject(String(response?.content || ''));
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      const toolCalls = (Array.isArray((parsed as any)?.toolCalls) ? (parsed as any).toolCalls : [])
        .filter((call: any) => call && typeof call === 'object')
        .map((call: any) => ({
          tool: String(call?.tool || '').trim(),
          input: call?.input && typeof call.input === 'object' ? call.input : {},
        }))
        .filter((call: any) => !!call.tool);
      return {
        message: String((parsed as any)?.message || '').trim(),
        toolCalls,
        model: String(response?.model || '').trim(),
      };
    } catch {
      return null;
    }
  }

  private static async summarizeToolResults(input: {
    aiClient: { chat: (params: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; json?: boolean; temperature?: number; maxTokens?: number }) => Promise<{ content?: string; model?: string }> };
    systemPrompt: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    message: string;
    toolResults: Array<{ tool: string; input: Record<string, any>; result: any }>;
    checkpointContext?: string;
    temperature: number;
    maxTokens: number;
    provider: string;
  }): Promise<ChatReply | null> {
    const replyPromptLines = [
      input.systemPrompt,
      '',
      'Answer the user using only the tool results below.',
      'Be direct, concise, and grounded in the data.',
      'If a tool result is incomplete, say what you could confirm instead of refusing generically.',
      `TOOL_RESULTS_JSON:${JSON.stringify(input.toolResults)}`,
    ];
    if (input.checkpointContext) {
      replyPromptLines.push(`Checkpoint context: ${input.checkpointContext}`);
    }
    const replyPrompt = replyPromptLines.join('\n');

    try {
      const response = await input.aiClient.chat({
        messages: [
          { role: 'system', content: replyPrompt },
          ...input.history,
          { role: 'user', content: input.message },
        ],
        json: false,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      });
      const content = String(response?.content || '').trim();
      if (!content) {
        return null;
      }
      return {
        message: content,
        model: String(response?.model || input.provider || 'ai'),
        source: 'tool_model',
      };
    } catch {
      return null;
    }
  }
  private static selectReadOnlyTools(
    context: RuntimeContext,
    message: string,
  ): Array<{ tool: string; description: string; metadata?: Record<string, unknown> }> {
    const allTools = (Array.isArray(context.tools) ? context.tools : [])
      .filter((tool) => tool?.readOnly === true)
      .map((tool) => ({
        tool: String(tool?.tool || '').trim(),
        description: String(tool?.description || '').trim(),
        metadata: tool?.metadata && typeof tool.metadata === 'object'
          ? { ...(tool.metadata as Record<string, unknown>) }
          : undefined,
      }))
      .filter((tool) => !!tool.tool);

    const ranked = FactualQueryToolService.rankReadOnlyTools(context, message);
    if (ranked.length === 0) return allTools.slice(0, 18);
    const byName = new Map(allTools.map((tool) => [tool.tool, tool]));
    const prioritized = ranked.flatMap((tool) => {
      const entry = byName.get(tool.tool);
      return entry ? [entry] : [];
    });
    const fallback = allTools.filter((tool) => !prioritized.some((entry) => entry.tool === tool.tool));
    return [...prioritized, ...fallback].slice(0, 18);
  }
  private static serializeToolCatalog(
    tools: Array<{ tool: string; description: string; metadata?: Record<string, unknown> }>,
  ): string {
    return JSON.stringify(tools.map((tool) => ({
      tool: tool.tool,
      description: tool.description,
      metadata: tool.metadata && typeof tool.metadata === 'object'
        ? { category: tool.metadata.category, entity: tool.metadata.entity, filters: tool.metadata.filters, returns: tool.metadata.returns, followupHints: tool.metadata.followupHints }
        : undefined,
    })));
  }

  private static buildCheckpointContext(context: RuntimeContext): string {
    const factual = context.checkpoint?.memory?.factual;
    if (factual?.tool) {
      return JSON.stringify({
        tool: factual.tool,
        input: factual.input,
        rangeLabel: factual.rangeLabel,
        rangeFrom: factual.rangeFrom,
        rangeTo: factual.rangeTo,
        primaryMetricPath: factual.primaryMetricPath,
      });
    }
    const listing = context.checkpoint?.memory?.listing;
    if (listing?.collectionSlug) {
      return JSON.stringify({ collectionSlug: listing.collectionSlug, lastSelectedRowIndex: listing.lastSelectedRowIndex, lastSelectedField: listing.lastSelectedField });
    }
    return '';
  }
}
