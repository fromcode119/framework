import type { AssistantPromptCopy, AssistantPromptProfile } from '../types';
import { ModelRouter } from './model-router';
import { WorkspaceMapService } from './workspace-map';
import { ChatHelpers } from './helpers/chat-helpers';
import { FactualQueryHelpers } from './factual-query-helpers';
import type { RuntimeContext, RuntimeDependencies, RuntimeIntent } from './types.types';
import type { ChatReply } from './chat-responder.types';
import { ReadOnlyChatToolLoop } from './read-only-chat-tool-loop';

export class ChatResponder {
  static async generateChatReply(
  context: RuntimeContext,
  deps: RuntimeDependencies,
  intent: RuntimeIntent,
  message: string,
  agentMode: 'basic' | 'advanced',
): Promise<ChatReply> {
      const aiClient = context.options.aiClient;
      if (!aiClient || typeof aiClient.chat !== 'function') {
        return ChatResponder.buildFallbackReply();
      }

      const { profile, copy } = await ChatHelpers.resolvePromptInput(context);
      const provider = String(context.input?.provider || '').trim().toLowerCase();
      const capabilities = deps.resolveProviderCapabilities(provider);
      const generation = ModelRouter.selectGenerationProfile({
        intentKind: intent.kind,
        capabilities,
        agentMode,
        selectedSkill: context.selectedSkill,
      });

      const systemPrompt = ChatHelpers.buildSystemPrompt({
        profile,
        copy,
        intent,
        workspaceSummary: WorkspaceMapService.buildWorkspacePromptSummary(context.workspaceMap),
      });
      const effectiveSystemPrompt = ChatResponder.appendClassifierHint(systemPrompt, intent);
      const history = ChatHelpers.normalizeChatHistory(context.history);
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: effectiveSystemPrompt },
        ...history,
        { role: 'user', content: message },
      ];

      const readOnlyReply = await ReadOnlyChatToolLoop.generateReply({
        context,
        systemPrompt: effectiveSystemPrompt,
        history,
        message,
        aiClient,
        temperature: generation.temperature,
        maxTokens: generation.maxTokens,
        provider,
      });
      if (readOnlyReply) {
        return readOnlyReply;
      }
      if (ReadOnlyChatToolLoop.requiresToolGrounding(message)) {
        if (FactualQueryHelpers.looksLikeEntityDetailQuestion(message)) {
          const groundedRecovery = await ChatResponder.generateRecoveryReply({
            aiClient,
            systemPrompt: effectiveSystemPrompt,
            history,
            message,
            provider,
            maxTokens: Math.min(320, generation.maxTokens),
            mode: 'grounded',
            context,
          });
          if (groundedRecovery) {
            return groundedRecovery;
          }
        }
        return ChatResponder.buildClarificationReply();
      }

      try {
        const response = await aiClient.chat({
          messages,
          temperature: generation.temperature,
          maxTokens: generation.maxTokens,
          json: false,
        });
        const content = String(response?.content || '').trim();
        if (content) {
          return {
            message: content,
            model: String(response?.model || provider || 'ai'),
            source: 'model',
          };
        }
      } catch {
        // Fall through to AI recovery prompt.
      }

      if (intent.kind !== 'factual_qa' || FactualQueryHelpers.looksLikeEntityDetailQuestion(message)) {
        const recoveryReply = await ChatResponder.generateRecoveryReply({
          aiClient,
          systemPrompt: effectiveSystemPrompt,
          history,
          message,
          provider,
          maxTokens: Math.min(240, generation.maxTokens),
          mode: intent.kind === 'factual_qa' ? 'grounded' : 'general',
          context,
        });
        if (recoveryReply) {
          return recoveryReply;
        }
      }
      return ChatResponder.buildClarificationReply();

  }

  private static async generateRecoveryReply(input: {
    aiClient: { chat: (params: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; json?: boolean; temperature?: number; maxTokens?: number }) => Promise<{ content?: string; model?: string }> };
    systemPrompt: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    message: string;
    provider: string;
    maxTokens: number;
    mode: 'grounded' | 'general';
    context: RuntimeContext;
  }): Promise<ChatReply | null> {
    const recoveryPrompt = [
      input.systemPrompt,
      '',
      input.mode === 'grounded'
        ? 'The user expects a grounded workspace answer.'
        : 'The previous response attempt failed or was empty.',
      'Do not use generic fallback language.',
      'If the conversation context is enough, answer directly.',
      'If a critical detail is missing, ask one specific clarification question.',
      'If the model or tools are blocked, explain the exact blocker in one short sentence.',
      `Checkpoint context: ${ChatResponder.serializeCheckpointContext(input.context)}`,
      `Available read-only tools: ${ChatResponder.serializeReadOnlyTools(input.context)}`,
    ].join('\n');

    try {
      const response = await input.aiClient.chat({
        messages: [
          { role: 'system', content: recoveryPrompt },
          ...input.history,
          { role: 'user', content: input.message },
        ],
        json: false,
        temperature: 0.1,
        maxTokens: input.maxTokens,
      });
      const content = String(response?.content || '').trim();
      if (!content) {
        return null;
      }
      return {
        message: content,
        model: String(response?.model || input.provider || 'ai'),
        source: 'model',
      };
    } catch {
      return null;
    }
  }

  private static serializeCheckpointContext(context: RuntimeContext): string {
    const memory = context.checkpoint?.memory;
    if (!memory || typeof memory !== 'object') {
      return 'none';
    }
    return JSON.stringify(memory);
  }

  private static serializeReadOnlyTools(context: RuntimeContext): string {
    const tools = (Array.isArray(context.tools) ? context.tools : [])
      .filter((tool) => tool?.readOnly === true)
      .slice(0, 12)
      .map((tool) => ({
        tool: String(tool?.tool || '').trim(),
        description: String(tool?.description || '').trim(),
        metadata: tool?.metadata && typeof tool.metadata === 'object'
          ? {
              category: tool.metadata.category,
              entity: tool.metadata.entity,
              filters: tool.metadata.filters,
              returns: tool.metadata.returns,
            }
          : undefined,
      }))
      .filter((tool) => !!tool.tool);
    return tools.length > 0 ? JSON.stringify(tools) : 'none';
  }

  private static appendClassifierHint(systemPrompt: string, intent: RuntimeIntent): string {
    const hint = String(intent.quickAnswer || '').trim();
    if (!hint) {
      return systemPrompt;
    }
    return `${systemPrompt}\n\nClassifier hint: ${hint}`;
  }

  private static buildClarificationReply(): ChatReply {
    return {
      message: 'I need one more concrete detail or a successful tool pass before I can answer that reliably.',
      model: 'system',
      source: 'clarify',
    };
  }

  private static buildFallbackReply(): ChatReply {
    return {
      message: 'The AI model is unavailable right now, so I cannot answer reliably yet.',
      model: 'system',
      source: 'fallback',
    };
  }
}
