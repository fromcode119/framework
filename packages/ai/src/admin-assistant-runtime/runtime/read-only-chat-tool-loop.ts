import { RuntimeMiscHelpers } from '../helpers/runtime-misc-helpers';
import { ReplyMessageBuilders } from '../helpers/reply-message-builders';
import { FactualQueryHelpers } from './factual-query-helpers';
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
    const readOnlyTools = (Array.isArray(input.context.tools) ? input.context.tools : [])
      .filter((tool) => tool?.readOnly === true)
      .map((tool) => ({
        tool: String(tool?.tool || '').trim(),
        description: String(tool?.description || '').trim(),
      }))
      .filter((tool) => !!tool.tool)
      .slice(0, 40);

    if (readOnlyTools.length === 0) {
      return null;
    }

    const toolPlan = await ReadOnlyChatToolLoop.planToolCalls({
      aiClient: input.aiClient,
      systemPrompt: input.systemPrompt,
      history: input.history,
      message: input.message,
      tools: readOnlyTools,
      temperature: input.temperature,
      maxTokens: Math.min(900, input.maxTokens),
    });
    if (!toolPlan) {
      return null;
    }

    const toolCalls = Array.isArray(toolPlan.toolCalls) ? toolPlan.toolCalls.slice(0, 2) : [];
    if (toolCalls.length === 0) {
      if (ReadOnlyChatToolLoop.requiresToolGrounding(input.message)) {
        return null;
      }
      const directMessage = String(toolPlan.message || '').trim();
      return directMessage
        ? {
            message: directMessage,
            model: String(toolPlan.model || input.provider || 'ai'),
            source: 'tool_model',
          }
        : null;
    }

    const toolResults: Array<{ tool: string; input: Record<string, any>; result: any }> = [];
    for (const call of toolCalls) {
      const toolName = String(call?.tool || '').trim();
      if (!toolName) {
        continue;
      }
      const toolInput = call?.input && typeof call.input === 'object' ? call.input : {};
      const result = await input.context.bridge.call({
        tool: toolName,
        input: toolInput,
        context: { dryRun: true },
      });
      toolResults.push({
        tool: toolName,
        input: toolInput,
        result,
      });
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
      temperature: Math.min(0.15, input.temperature),
      maxTokens: Math.min(700, input.maxTokens),
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
    tools: Array<{ tool: string; description: string }>;
    temperature: number;
    maxTokens: number;
  }): Promise<{ message: string; toolCalls: Array<{ tool: string; input: Record<string, any> }>; model: string } | null> {
    const plannerPrompt = [
      input.systemPrompt,
      '',
      'You can answer read-only workspace questions by selecting read-only tools.',
      'Prefer a useful grounded answer over a vague fallback.',
      'For workspace data, plugin-access, or business metric questions, do not guess and do not claim lack of access before checking tools.',
      'Return STRICT JSON only with this shape:',
      '{"message":"string","toolCalls":[{"tool":"string","input":{}}]}',
      'Use at most 2 read-only tool calls.',
      'Only return toolCalls as an empty array when the answer is already obvious from the conversation and does not require workspace inspection.',
      `Available read-only tools: ${JSON.stringify(input.tools)}`,
    ].join('\n');

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
    temperature: number;
    maxTokens: number;
    provider: string;
  }): Promise<ChatReply | null> {
    const replyPrompt = [
      input.systemPrompt,
      '',
      'Answer the user using only the tool results below.',
      'Be direct, concise, and grounded in the data.',
      'If a tool result is incomplete, say what you could confirm instead of refusing generically.',
      `TOOL_RESULTS_JSON:${JSON.stringify(input.toolResults)}`,
    ].join('\n');

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
}
