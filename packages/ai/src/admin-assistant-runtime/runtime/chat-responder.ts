import { ResponderRoute } from '@ai/admin-assistant-runtime/enums/responder-route.enum';
import { AnswerGrounding } from '@ai/admin-assistant-runtime/enums/answer-grounding.enum';
import { ContextLevel } from '@ai/api/forge/enums/context-level.enum';
import { AssistantRole } from '@ai/enums/assistant-role.enum';

import { ModelRouter } from '@ai/admin-assistant-runtime/runtime/model-router';
import { WorkspaceMapService } from '@ai/admin-assistant-runtime/runtime/workspace-map';
import { ChatHelpers } from '@ai/admin-assistant-runtime/runtime/helpers/chat-helpers';
import { FactualQueryHelpers } from '@ai/admin-assistant-runtime/runtime/factual-query-helpers';
import type { IRuntimeContext } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-context.interface';
import type { IRuntimeDependencies } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-dependencies.interface';
import type { IRuntimeIntent } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-intent.interface';
import type { IChatReply } from '@ai/admin-assistant-runtime/runtime/interfaces/chat-reply.interface';
import { ReadOnlyChatToolLoop } from '@ai/admin-assistant-runtime/runtime/read-only-chat-tool-loop';
import { RuntimeIntentKind } from '@ai/admin-assistant-runtime/runtime/enums/runtime-intent-kind.enum';

export class ChatResponder {
  static async generateChatReply(
  context: IRuntimeContext,
  deps: IRuntimeDependencies,
  intent: IRuntimeIntent,
  message: string,
  agentMode: ContextLevel,
): Promise<IChatReply> {
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
      const messages: Array<{ role: AssistantRole; content: string }> = [
        { role: AssistantRole.SYSTEM, content: effectiveSystemPrompt },
        ...history,
        { role: AssistantRole.USER, content: message },
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
            mode: AnswerGrounding.GROUNDED,
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
            source: ResponderRoute.MODEL,
          };
        }
      } catch {
        // Fall through to AI recovery prompt.
      }

      if (intent.kind !== RuntimeIntentKind.FACTUAL_QA || FactualQueryHelpers.looksLikeEntityDetailQuestion(message)) {
        const recoveryReply = await ChatResponder.generateRecoveryReply({
          aiClient,
          systemPrompt: effectiveSystemPrompt,
          history,
          message,
          provider,
          maxTokens: Math.min(240, generation.maxTokens),
          mode: intent.kind === RuntimeIntentKind.FACTUAL_QA ? AnswerGrounding.GROUNDED : AnswerGrounding.GENERAL,
          context,
        });
        if (recoveryReply) {
          return recoveryReply;
        }
      }
      return ChatResponder.buildClarificationReply();

  }

  private static async generateRecoveryReply(input: {
    aiClient: { chat: (params: { messages: Array<{ role: AssistantRole; content: string }>; json?: boolean; temperature?: number; maxTokens?: number }) => Promise<{ content?: string; model?: string }> };
    systemPrompt: string;
    history: Array<{ role: AssistantRole; content: string }>;
    message: string;
    provider: string;
    maxTokens: number;
    mode: AnswerGrounding;
    context: IRuntimeContext;
  }): Promise<IChatReply | null> {
    const recoveryPrompt = [
      input.systemPrompt,
      '',
      input.mode === AnswerGrounding.GROUNDED
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
          { role: AssistantRole.SYSTEM, content: recoveryPrompt },
          ...input.history,
          { role: AssistantRole.USER, content: input.message },
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
        source: ResponderRoute.MODEL,
      };
    } catch {
      return null;
    }
  }

  private static serializeCheckpointContext(context: IRuntimeContext): string {
    const memory = context.checkpoint?.memory;
    if (!memory || typeof memory !== 'object') {
      return 'none';
    }
    return JSON.stringify(memory);
  }

  private static serializeReadOnlyTools(context: IRuntimeContext): string {
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

  private static appendClassifierHint(systemPrompt: string, intent: IRuntimeIntent): string {
    const hint = String(intent.quickAnswer || '').trim();
    if (!hint) {
      return systemPrompt;
    }
    return `${systemPrompt}\n\nClassifier hint: ${hint}`;
  }

  private static buildClarificationReply(): IChatReply {
    return {
      message: 'I need one more concrete detail or a successful tool pass before I can answer that reliably.',
      model: 'system',
      source: 'clarify',
    };
  }

  private static buildFallbackReply(): IChatReply {
    return {
      message: 'The AI model is unavailable right now, so I cannot answer reliably yet.',
      model: 'system',
      source: ResponderRoute.FALLBACK,
    };
  }
}
