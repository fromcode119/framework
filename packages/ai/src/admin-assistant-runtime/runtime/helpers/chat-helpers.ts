import type { AssistantPromptCopy, AssistantPromptProfile } from '../../types';
import type { RuntimeIntent, RuntimeContext } from '../types.types';

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
   * const response = ChatHelpers.fallbackSmalltal('hey there');
   * // => "Hey. What do you want to talk about?"
   */
  static fallbackSmalltalk(message: string): string {
    const text = String(message || '').trim();
    if (/^hey|^hi|^hello/i.test(text)) return 'Hey. What do you want to talk about?';
    if (/let'?s chat/i.test(text)) return 'Sure. Pick a topic and we can dig in.';
    return 'Tell me what you need and I will help.';
  }

  /**
   * Generate fallback response for factual questions
   * 
   * @param intent - The classified intent
   * @returns Factual fallback response
   * 
   * @example
   * const response = ChatHelpers.fallbackFactual({ kind: 'factual_qa', quickAnswer: 'Answer' });
   * // => "Answer"
   */
  static fallbackFactual(intent: RuntimeIntent): string {
    if (intent.quickAnswer) return intent.quickAnswer;
    return 'I can help with that. Share a bit more detail so I can answer precisely.';
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
    history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    return (Array.isArray(history) ? history : [])
      .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
      .slice(-16)
      .map((entry) => ({
        role: (entry.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
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
  static async resolvePromptInput(context: RuntimeContext): Promise<{
    profile: AssistantPromptProfile;
    copy: AssistantPromptCopy;
  }> {
    const collections = Array.isArray(context.collections) ? context.collections : [];
    const plugins = typeof context.options.getPlugins === 'function' ? context.options.getPlugins() || [] : [];
    const tools = Array.isArray(context.tools) ? context.tools : [];

    const profile = typeof context.options.resolvePromptProfile === 'function'
      ? await Promise.resolve(context.options.resolvePromptProfile({ collections, plugins, tools }) || {})
      : {};
    const copy = typeof context.options.resolvePromptCopy === 'function'
      ? await Promise.resolve(context.options.resolvePromptCopy({ collections, plugins, tools }) || {})
      : {};

    return { profile: profile || {}, copy: copy || {} };
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
   *   intent: { kind: 'chat', confidence: 0.9 },
   *   workspaceSummary: 'Collections: posts, pages'
   * });
   * // => "You are Forge Assistant.\nChat naturally..."
   */
 static buildSystemPrompt(input: {
    profile: AssistantPromptProfile;
    copy: AssistantPromptCopy;
    intent: RuntimeIntent;
    workspaceSummary: string;
  }): string {
    const base = [
      'You are Forge Assistant.',
      'Chat naturally when the user is chatting or asking factual questions.',
      'Do not force staging, planning, or approval language unless the user asked to change data/files.',
      'If a target is missing for an action, ask one focused clarification and stop.',
      'Never claim changes were applied unless execution confirms it.',
    ];

    const profileLine =
      input.intent.kind === 'chat' || input.intent.kind === 'smalltalk' || input.intent.kind === 'factual_qa'
        ? String(input.profile.basicSystem || '').trim()
        : String(input.profile.advancedSystem || '').trim();
    if (profileLine) base.push(profileLine);

    const copyLines = input.intent.kind === 'chat' || input.intent.kind === 'smalltalk' || input.intent.kind === 'factual_qa'
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
