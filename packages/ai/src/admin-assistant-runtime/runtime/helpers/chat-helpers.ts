import { AssistantRole } from '@ai/enums/assistant-role.enum';
import type { IAssistantPromptCopy } from '@ai/admin-assistant-runtime/interfaces/assistant-prompt-copy.interface';
import type { IAssistantPromptProfile } from '@ai/admin-assistant-runtime/interfaces/assistant-prompt-profile.interface';
import type { IRuntimeIntent } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-intent.interface';
import type { IRuntimeContext } from '@ai/admin-assistant-runtime/runtime/interfaces/runtime-context.interface';
import { RuntimeIntentKind } from '@ai/admin-assistant-runtime/runtime/enums/runtime-intent-kind.enum';
import { AssistantRuntimeCapabilities } from '@ai/admin-assistant-runtime/assistant-runtime-capabilities';

/**
 * Chat operations utilities for AI assistant runtime
 * Handles chat history normalization, fallback responses, and prompt building
 */
export class ChatHelpers {
  /**
   * Generate friendly fallback response for smalltalk/casual conversation
   * 
   * @param message - The user's message
   * @returns Friendly fallback response
   * 
   * @example
   * const response = ChatHelpers.fallbackSmalltalk('hey there');
   * // => "Hey. What do you want to talk about?"
   */
  static fallbackSmalltalk(message: string): string {
    return 'Ask a concrete workspace question and I will check it directly.';
  }

  /**
   * Generate fallback response for factual questions
   * 
   * @param intent - The classified intent
   * @returns Factual fallback response
   * 
   * @example
   * const response = ChatHelpers.fallbackFactual({ kind: RuntimeIntentKind.FACTUAL_QA, quickAnswer: 'Answer' });
   * // => "Answer"
   */
  static fallbackFactual(intent: IRuntimeIntent): string {
    if (intent.quickAnswer) return intent.quickAnswer;
    return 'Ask a concrete target, metric, or time window and I will check it directly.';
  }

  /**
   * Normalize chat history by filtering, trimming, and limiting to recent messages
   * 
   * @param history - The raw chat history
   * @returns Normalized chat history (max 16 messages, user/assistant only)
   * 
   * @example
   * const normalized = ChatHelpers.normalizeChatHistory([
   *   { role: 'system', content: 'You are an assistant' },
   *   { role: 'user', content: 'Hello' },
   *   { role: 'assistant', content: 'Hi there!' }
   * ]);
   * // => [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi there!' }]
   */
  static normalizeChatHistory(
    history: Array<{ role: AssistantRole; content: string }>
  ): Array<{ role: AssistantRole; content: string }> {
    return (Array.isArray(history) ? history : [])
      .filter((entry) => entry.role === AssistantRole.USER || entry.role === AssistantRole.ASSISTANT)
      .slice(-16)
      .map((entry) => ({
        role: entry.role === AssistantRole.ASSISTANT ? AssistantRole.ASSISTANT : AssistantRole.USER,
        content: String(entry.content || '').trim(),
      }))
      .filter((entry) => !!entry.content);
  }

  /**
   * Resolve prompt profile and copy from runtime context
   * 
   * @param context - The runtime context
   * @returns Promise resolving to profile and copy
   * 
   * @example
   * const { profile, copy } = await ChatHelpers.resolvePromptInput(context);
   */
  static async resolvePromptInput(context: IRuntimeContext): Promise<{
    profile: IAssistantPromptProfile;
    copy: IAssistantPromptCopy;
  }> {
    const collections = Array.isArray(context.collections) ? context.collections : [];
    const plugins = AssistantRuntimeCapabilities.getPlugins(context.options);
    const tools = Array.isArray(context.tools) ? context.tools : [];

    const profile = await AssistantRuntimeCapabilities.resolvePromptProfile(context.options, { collections, plugins, tools });
    const copy = await AssistantRuntimeCapabilities.resolvePromptCopy(context.options, { collections, plugins, tools });

    return { profile, copy };
  }

  /**
   * Build system prompt from profile, copy, intent, and workspace summary
   * 
   * @param input - Prompt building inputs
   * @returns Constructed system prompt
   * 
   * @example
   * const prompt = ChatHelpers.buildSystemPrompt({
   *   profile: { basicSystem: 'Assistant persona', advancedSystem: 'Advanced system' },
   *   copy: { basic: ['Be helpful'], advanced: ['Execute precisely'] },
   *   intent: { kind: RuntimeIntentKind.CHAT, confidence: 0.9 },
   *   workspaceSummary: 'Collections: posts, pages'
   * });
   * // => "You are Atlantis Intelligence.\nChat naturally..."
   */
 static buildSystemPrompt(input: {
    profile: IAssistantPromptProfile;
    copy: IAssistantPromptCopy;
    intent: IRuntimeIntent;
    workspaceSummary: string;
  }): string {
    const base = [
      'You are Atlantis Intelligence.',
      'Chat naturally when the user is chatting or asking factual questions.',
      'Do not force staging, planning, or approval language unless the user asked to change data/files.',
      'If a target is missing for an action, ask one focused clarification and stop.',
      'Never claim changes were applied unless execution confirms it.',
    ];

    const profileLine =
      input.intent.kind === RuntimeIntentKind.CHAT || input.intent.kind === RuntimeIntentKind.SMALLTALK || input.intent.kind === RuntimeIntentKind.FACTUAL_QA
        ? String(input.profile.basicSystem || '').trim()
        : String(input.profile.advancedSystem || '').trim();
    if (profileLine) base.push(profileLine);

    const copyLines = input.intent.kind === RuntimeIntentKind.CHAT || input.intent.kind === RuntimeIntentKind.SMALLTALK || input.intent.kind === RuntimeIntentKind.FACTUAL_QA
      ? (Array.isArray(input.copy.basic) ? input.copy.basic : [])
      : (Array.isArray(input.copy.advanced) ? input.copy.advanced : []);
    for (const line of copyLines.slice(0, 8)) {
      const trimmed = String(line || '').trim();
      if (trimmed) base.push(trimmed);
    }

    const workspaceSummary = String(input.workspaceSummary || '').trim();
    if (workspaceSummary) base.push(workspaceSummary);

    return base.join('\n');
  }
}
