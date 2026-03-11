import type { AssistantPromptCopy, AssistantPromptProfile } from '../types';
import { ModelRouter } from './model-router';
import { WorkspaceMapService } from './workspace-map';
import { ChatHelpers } from './helpers/chat-helpers';
import type { RuntimeContext, RuntimeDependencies, RuntimeIntent } from './types.types';
import type { ChatReply } from './chat-responder.types';

export class ChatResponder {
  static async generateChatReply(
  context: RuntimeContext,
  deps: RuntimeDependencies,
  intent: RuntimeIntent,
  message: string,
  agentMode: 'basic' | 'advanced',
): Promise<ChatReply> {
      if (intent.kind === 'factual_qa' && intent.quickAnswer) {
        return { message: intent.quickAnswer, model: 'deterministic-factual', source: 'quick' };
      }

      const aiClient = context.options.aiClient;
      if (!aiClient || typeof aiClient.chat !== 'function') {
        if (intent.kind === 'factual_qa') {
          return { message: ChatHelpers.fallbackFactual(intent), model: 'fallback', source: 'fallback' };
        }
        return { message: ChatHelpers.fallbackSmalltalk(message), model: 'fallback', source: 'fallback' };
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
      const history = ChatHelpers.normalizeChatHistory(context.history);
      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message },
      ];

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
        // Fall through to local fallback.
      }

      if (intent.kind === 'factual_qa') {
        return { message: ChatHelpers.fallbackFactual(intent), model: 'fallback', source: 'fallback' };
      }
      return { message: ChatHelpers.fallbackSmalltalk(message), model: 'fallback', source: 'fallback' };

  }
}